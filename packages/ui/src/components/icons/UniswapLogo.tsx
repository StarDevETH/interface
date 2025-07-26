// packages/ui/src/components/icons/UniswapLogo.tsx
import { Image, ImageProps, ImageStyle, StyleProp } from 'react-native'
import { createIcon } from '../factories/createIcon'

export type UniswapLogoProps = {
  size?: number
  style?: StyleProp<ImageStyle>
  color?: string // pulled out so it never gets forwarded
} & Omit<ImageProps, 'source' | 'style'>

export const [UniswapLogo, AnimatedUniswapLogo] = createIcon({
  name: 'UniswapLogo',
  // ----------------------------------------------------
  // @ts-ignore: we know `createIcon` expects SVG props,
  // but we’re actually returning an <Image>
  getIcon: ({ size = 96, style, color, ...restProps }: UniswapLogoProps) => (
    <Image
      source={require('../../../../../apps/web/public/favicon.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      {...restProps}
    />
  ),
  // ----------------------------------------------------
})
