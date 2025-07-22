import express from 'express'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

/**
 * Placeholder function for fetching a swap quote.
 * TODO: Replace with real implementation using onchain data
 * or subgraph queries.
 */
async function getQuote(params: any) {
  // Implementation would query Uniswap pools and compute best route
  // For now we return mock data
  return {
    amountIn: params.amountIn,
    amountOut: '0',
    route: [],
  }
}

/**
 * Placeholder function for fetching spot price of a token.
 * TODO: Replace with real onchain or oracle-based price lookup.
 */
async function getPrice(token: string, chainId: number) {
  return {
    token,
    chainId,
    priceUsd: '0',
  }
}

/**
 * Placeholder function for returning list of tradable tokens.
 * TODO: Populate from onchain data or token lists.
 */
async function listTokens(chainId: number) {
  return []
}

app.post('/v1/quote', async (req, res) => {
  try {
    const quote = await getQuote(req.body)
    res.json(quote)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to compute quote' })
  }
})

app.get('/v1/price', async (req, res) => {
  try {
    const { token, chainId } = req.query
    const price = await getPrice(String(token), Number(chainId))
    res.json(price)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to fetch price' })
  }
})

app.get('/v1/tokens', async (req, res) => {
  try {
    const { chainId } = req.query
    const tokens = await listTokens(Number(chainId))
    res.json(tokens)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to list tokens' })
  }
})

app.listen(port, () => {
  console.log(`Trading API server listening on port ${port}`)
})
