// TODO(MOB-203): reduce component complexity
/* eslint-disable complexity */
import { BigNumber } from '@ethersproject/bignumber'
import { Direction, OnChainTransaction, OnChainTransactionLabel } from '@uniswap/client-data-api/dist/data/v1/types_pb'
import {
  TokenStandard,
  TransactionDirection,
} from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { fromGraphQLChain } from 'uniswap/src/features/chains/utils'
import {
  ConfirmedSwapTransactionInfo,
  NFTTradeTransactionInfo,
  NFTTradeType,
  TransactionDetailsType,
  TransactionListQueryResponse,
  TransactionType,
  WrapTransactionInfo,
} from 'uniswap/src/features/transactions/types/transactionDetails'
import { buildCurrencyId, buildNativeCurrencyId, buildWrappedNativeCurrencyId } from 'uniswap/src/utils/currencyId'
import {
  deriveCurrencyAmountFromAssetResponse,
  parseUSDValueFromAssetChange,
} from 'wallet/src/features/transactions/history/utils'

type TransferAssetChange = Extract<
  NonNullable<
    Extract<
      NonNullable<TransactionListQueryResponse>['details'],
      { __typename?: 'TransactionDetails' | undefined }
    >['assetChanges']
  >[0],
  { __typename: 'TokenTransfer' | 'NftTransfer' }
>

export default function parseTradeTransaction(
  transaction: NonNullable<TransactionListQueryResponse>,
): ConfirmedSwapTransactionInfo | NFTTradeTransactionInfo | WrapTransactionInfo | undefined {
  // ignore UniswapX transactions for now
  if (transaction.details.__typename !== TransactionDetailsType.Transaction) {
    return undefined
  }

  const chainId = fromGraphQLChain(transaction.chain)
  if (!chainId) {
    return undefined
  }

  const txAssetChanges = transaction.details.assetChanges.filter(
    (t): t is TransferAssetChange => t?.__typename === 'TokenTransfer' || t?.__typename === 'NftTransfer',
  )

  // for detecting wraps
  const nativeCurrencyID = buildNativeCurrencyId(chainId).toLocaleLowerCase()
  const wrappedCurrencyID = buildWrappedNativeCurrencyId(chainId).toLocaleLowerCase()

  const sent = txAssetChanges.find((t) => t.direction === TransactionDirection.Out)

  const { received, refund } = txAssetChanges.reduce<{
    refund?: Extract<TransferAssetChange, { __typename: 'TokenTransfer' }>
    received?: TransferAssetChange
  }>(
    (acc, t) => {
      if (t.direction !== TransactionDirection.In) {
        return acc
      }

      const isRefundInternalTx =
        t.__typename === 'TokenTransfer' && t.asset.id === sent?.asset.id && t.tokenStandard === TokenStandard.Native

      if (isRefundInternalTx) {
        acc.refund = t
      } else {
        acc.received = t
      }

      return acc
    },
    {
      refund: undefined,
      received: undefined,
    },
  )

  // Invalid input/output info
  if (!sent || !received) {
    return undefined
  }

  const onlyERC20Tokens = sent.__typename === 'TokenTransfer' && received.__typename === 'TokenTransfer'
  const containsNFT = sent.__typename === 'NftTransfer' || received.__typename === 'NftTransfer'

  if (!(onlyERC20Tokens || containsNFT)) {
    return undefined
  }

  // Token swap
  if (onlyERC20Tokens) {
    const inputCurrencyId =
      sent.tokenStandard === TokenStandard.Native
        ? buildNativeCurrencyId(chainId)
        : sent.asset.address
          ? buildCurrencyId(chainId, sent.asset.address)
          : null
    const outputCurrencyId =
      received.tokenStandard === TokenStandard.Native
        ? buildNativeCurrencyId(chainId)
        : received.asset.address
          ? buildCurrencyId(chainId, received.asset.address)
          : null
    let inputCurrencyAmountRaw = deriveCurrencyAmountFromAssetResponse({
      tokenStandard: sent.tokenStandard,
      chain: sent.asset.chain,
      address: sent.asset.address,
      decimals: sent.asset.decimals,
      quantity: sent.quantity,
    })

    if (refund && refund.tokenStandard === sent.tokenStandard) {
      const refundCurrencyAmountRaw = deriveCurrencyAmountFromAssetResponse({
        tokenStandard: refund.tokenStandard,
        chain: refund.asset.chain,
        address: refund.asset.address,
        decimals: refund.asset.decimals,
        quantity: refund.quantity,
      })

      inputCurrencyAmountRaw = BigNumber.from(inputCurrencyAmountRaw).sub(refundCurrencyAmountRaw).toString()
    }

    const outputCurrencyAmountRaw = deriveCurrencyAmountFromAssetResponse({
      tokenStandard: received.tokenStandard,
      chain: received.asset.chain,
      address: received.asset.address,
      decimals: received.asset.decimals,
      quantity: received.quantity,
    })

    const transactedUSDValue = parseUSDValueFromAssetChange(sent.transactedValue)

    // Data API marks wrap as a swap.
    if (
      (inputCurrencyId?.toLocaleLowerCase() === nativeCurrencyID &&
        outputCurrencyId?.toLocaleLowerCase() === wrappedCurrencyID) ||
      (inputCurrencyId?.toLocaleLowerCase() === wrappedCurrencyID &&
        outputCurrencyId?.toLocaleLowerCase() === nativeCurrencyID)
    ) {
      return {
        type: TransactionType.Wrap,
        unwrapped: outputCurrencyId.toLocaleLowerCase() === nativeCurrencyID.toLocaleLowerCase(),
        currencyAmountRaw: inputCurrencyAmountRaw,
      }
    }

    if (!inputCurrencyId || !outputCurrencyId) {
      return undefined
    }

    return {
      type: TransactionType.Swap,
      inputCurrencyId,
      outputCurrencyId,
      transactedUSDValue,
      inputCurrencyAmountRaw,
      outputCurrencyAmountRaw,
    }
  }

  // NFT trade found
  if (containsNFT) {
    const nftChange = [received, sent].find((t) => t.__typename === 'NftTransfer')
    const tokenChange = [received, sent].find((t) => t.__typename === 'TokenTransfer')
    // TODO: [MOB-236] Monitor txns where we have only NFT swaps
    if (nftChange?.__typename !== 'NftTransfer' || tokenChange?.__typename !== 'TokenTransfer') {
      return undefined
    }
    const name = nftChange.asset.name
    const collectionName = nftChange.asset.collection?.name
    const imageURL = nftChange.asset.image?.url
    const tokenId = nftChange.asset.tokenId
    const purchaseCurrencyId =
      tokenChange.tokenStandard === TokenStandard.Native
        ? buildNativeCurrencyId(chainId)
        : tokenChange.asset.address
          ? buildCurrencyId(chainId, tokenChange.asset.address)
          : undefined
    const purchaseCurrencyAmountRaw = deriveCurrencyAmountFromAssetResponse({
      tokenStandard: tokenChange.tokenStandard,
      chain: tokenChange.asset.chain,
      address: tokenChange.asset.address,
      decimals: tokenChange.asset.decimals,
      quantity: tokenChange.quantity,
    })
    const tradeType = nftChange.direction === 'IN' ? NFTTradeType.BUY : NFTTradeType.SELL

    const transactedUSDValue = parseUSDValueFromAssetChange(tokenChange.transactedValue)

    const address = nftChange.asset.nftContract?.address

    if (
      !name ||
      !collectionName ||
      !imageURL ||
      !tokenId ||
      !purchaseCurrencyId ||
      !purchaseCurrencyAmountRaw ||
      !address
    ) {
      return undefined
    }
    return {
      type: TransactionType.NFTTrade,
      tradeType,
      nftSummaryInfo: {
        name,
        collectionName,
        imageURL,
        tokenId,
        address,
      },
      purchaseCurrencyId,
      purchaseCurrencyAmountRaw,
      transactedUSDValue,
    }
  }

  return undefined
}

/**
 * Parse a swap transaction from the REST API
 */
export function parseRestSwapTransaction(transaction: OnChainTransaction): ConfirmedSwapTransactionInfo | undefined {
  const { transfers, chainId } = transaction
  if (transfers.length < 2) {
    return undefined
  }

  const sentTransfer = transfers.find((t) => t.direction === Direction.SEND)
  const receivedTransfer = transfers.find((t) => t.direction === Direction.RECEIVE)
  if (!sentTransfer || !receivedTransfer) {
    return undefined
  }

  const inputToken = sentTransfer.asset.value
  const outputToken = receivedTransfer.asset.value
  if (!inputToken || !outputToken) {
    return undefined
  }

  return {
    type: TransactionType.Swap,
    inputCurrencyId: buildCurrencyId(chainId, inputToken.address),
    outputCurrencyId: buildCurrencyId(chainId, outputToken.address),
    inputCurrencyAmountRaw: sentTransfer.amount?.raw ?? '',
    outputCurrencyAmountRaw: receivedTransfer.amount?.raw ?? '',
    transactedUSDValue: undefined,
  }
}

/**
 * Parse a Wrap transaction from the REST API
 */
export function parseRestWrapTransaction(transaction: OnChainTransaction): WrapTransactionInfo | undefined {
  const { transfers, label } = transaction
  const firstTransfer = transfers[0]

  if (transfers.length < 2) {
    return undefined
  }

  return {
    type: TransactionType.Wrap,
    unwrapped: label === OnChainTransactionLabel.WITHDRAW || label === OnChainTransactionLabel.UNWRAP,
    currencyAmountRaw: firstTransfer?.amount?.raw ?? '',
  }
}
