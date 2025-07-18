import getToken from '../../utils/getToken'
import { transformResponse } from '../../utils/transformResponse'

export const onRequest: PagesFunction = async ({ params, request, next }) => {
  const response = next()
  try {
    const { index } = params
    const networkName = index[0]?.toString()
    const tokenAddress = index[1]?.toString()
    if (!tokenAddress) {
      return response
    }
    return transformResponse({
      request,
      response: await response,
      data: () => getToken({ networkName, tokenAddress, url: request.url }),
    })
  } catch (e) {
    return response
  }
}
