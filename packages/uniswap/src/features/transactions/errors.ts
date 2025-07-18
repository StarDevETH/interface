import { datadogRum } from '@datadog/browser-rum'
import { AppTFunction } from 'ui/src/i18n/types'
import { uniswapUrls } from 'uniswap/src/constants/urls'
import { FetchError } from 'uniswap/src/data/apiClients/FetchError'
import { TokenApprovalTransactionStep } from 'uniswap/src/features/transactions/steps/approve'
import { TokenRevocationTransactionStep } from 'uniswap/src/features/transactions/steps/revoke'
import { TransactionStep, TransactionStepType } from 'uniswap/src/features/transactions/steps/types'
import { isInterface } from 'utilities/src/platform'

/** Superclass used to differentiate categorized/known transaction errors from generic/unknown errors. */
export abstract class TransactionError extends Error {}

/** Thrown in code paths that should be unreachable, serving both typechecking and critical alarm purposes. */
export class UnexpectedTransactionStateError extends TransactionError {
  constructor(message: string) {
    super(message)
    this.name = 'UnexpectedTransactionStateError'
  }
}

/** Thrown when a transaction step fails for an unknown reason. */
export class TransactionStepFailedError extends TransactionError {
  step: TransactionStep
  isBackendRejection: boolean
  originalError?: Error

  originalErrorStringified?: string
  originalErrorString?: string // originalErrorStringified error may get cut off by size limits; this acts as minimal backup
  stepStringified?: string

  constructor({
    message,
    step,
    isBackendRejection = false,
    originalError,
  }: {
    message: string
    step: TransactionStep
    isBackendRejection?: boolean
    originalError?: Error
  }) {
    super(message)
    this.name = 'TransactionStepFailedError'
    this.step = step
    this.isBackendRejection = isBackendRejection
    this.originalError = originalError

    try {
      this.originalErrorString = originalError?.toString()
      this.originalErrorStringified = JSON.stringify(originalError, null, 2)
      this.stepStringified = JSON.stringify(step, null, 2)
    } catch {}
  }

  getFingerprint(): string[] {
    const fingerprint: string[] = [this.step.type]

    try {
      if (
        this.originalError &&
        'code' in this.originalError &&
        (typeof this.originalError.code === 'string' || typeof this.originalError.code === 'number')
      ) {
        fingerprint.push(String(this.originalError.code))
      }

      if (this.originalError?.message) {
        fingerprint.push(String(this.originalError.message))
      }

      if (this.isBackendRejection && this.originalError instanceof FetchError && this.originalError.data?.detail) {
        fingerprint.push(String(this.originalError.data.detail))
      }
    } catch (e) {
      if (isInterface) {
        datadogRum.addAction('Transaction Action', {
          message: `problem determining fingerprint for ${this.step.type}`,
          level: 'info',
          step: this.step.type,
          data: {
            errorMessage: e instanceof Error ? e.message : undefined,
          },
        })
      }
    }

    return fingerprint
  }
}

export class ApprovalEditedInWalletError extends TransactionStepFailedError {
  logError = false

  constructor({ step }: { step: TokenApprovalTransactionStep | TokenRevocationTransactionStep }) {
    super({ message: 'Approval decreased to insufficient amount in wallet', step })
  }
}

/** Thrown when a transaction flow is interrupted by a known circumstance; should be handled gracefully in UI */
export class HandledTransactionInterrupt extends TransactionError {
  constructor(message: string) {
    super(message)
    this.name = 'HandledTransactionInterrupt'
  }
}

export function getErrorContent(
  t: AppTFunction,
  error: Error,
): {
  title: string
  buttonText?: string
  message: string
  supportArticleURL?: string
} {
  if (error instanceof TransactionStepFailedError) {
    return getStepSpecificErrorContent(t, error)
  }

  // Generic / default error
  return {
    title: t('common.unknownError.error'),
    message: t('common.swap.failed'),
  }
}

function getStepSpecificErrorContent(
  t: AppTFunction,
  error: TransactionStepFailedError,
): {
  title: string
  buttonText?: string
  message: string
  supportArticleURL?: string
} {
  switch (error.step.type) {
    case TransactionStepType.WrapTransaction:
      return {
        title: t('common.wrap.failed'),
        message: t('token.wrap.fail.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.wethExplainer,
      }
    case TransactionStepType.SwapTransaction:
    case TransactionStepType.SwapTransactionAsync:
      return {
        title: t('common.swap.failed'),
        message: t('swap.fail.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.transactionFailure,
      }
    case TransactionStepType.SwapTransactionBatched:
      return {
        title: t('swap.fail.batched.title'),
        buttonText: t('swap.fail.batched.retry'),
        message: t('swap.fail.batched'),
        supportArticleURL: uniswapUrls.helpArticleUrls.transactionFailure,
      }
    case TransactionStepType.UniswapXSignature:
      if (error.isBackendRejection) {
        return {
          title: t('common.swap.failed'),
          message: t('swap.fail.uniswapX'),
          supportArticleURL: uniswapUrls.helpArticleUrls.uniswapXFailure,
        }
      }
      return {
        title: t('common.swap.failed'),
        message: t('swap.fail.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.uniswapXFailure,
      }
    case TransactionStepType.Permit2Signature:
      return {
        title: t('permit.approval.fail'),
        message: t('permit.approval.fail.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.approvalsExplainer,
      }
    case TransactionStepType.TokenApprovalTransaction:
      if (error instanceof ApprovalEditedInWalletError) {
        return {
          title: t('error.tokenApprovalEdited'),
          message: t('error.tokenApprovalEdited.message'),
          supportArticleURL: uniswapUrls.helpArticleUrls.approvalsExplainer,
        }
      }
      return {
        title: t('error.tokenApproval'),
        message: t('error.tokenApproval.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.approvalsExplainer,
      }
    case TransactionStepType.TokenRevocationTransaction:
      return {
        title: t('common.revoke.approval.failed'),
        message: t('revoke.failed.message'),
        supportArticleURL: uniswapUrls.helpArticleUrls.revokeExplainer,
      }
    default:
      return {
        title: t('common.unknownError.error'),
        message: t('common.swap.failed'),
      }
  }
}
