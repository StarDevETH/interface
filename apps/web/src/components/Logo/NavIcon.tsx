import React, { SVGProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Flex, styled, useSporeColors } from 'ui/src'

/** Simple logo as an <img> */
const Logo: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <img
    src="/images/orbit-logo-150.png" // public/images/orbit-logo-150.png
    alt="Orbit Logo"
    width={22}
    height={22}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default', display: 'block' }}
  />
)

/** Holiday logo rendered as an SVG */
interface HolidayLogoProps extends SVGProps<SVGSVGElement> {
  color: string
  onClick?: () => void
}

const HolidayLogo: React.FC<HolidayLogoProps> = ({ color, onClick, ...svgProps }) => {
  const { t } = useTranslation()
  const size = 32

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 41 41"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
      cursor={onClick ? 'pointer' : undefined}
      aria-label={t('common.happyHolidays')}
      {...svgProps}
    >
      <g clipPath="url(#clip0_38_2)">
        <path
          d="M16.4448 0.5C16.4448 0.22386 16.221 0 15.9448 0C15.6687 0 15.4448 0.22386 15.4448 0.5V2.0673L14.0876 1.2837C13.8484 1.14562 13.5426 1.22756 13.4046 1.46671C13.2665 1.70585 13.3484 2.01165 13.5876 2.14972L14.9453 2.9336L13.5888 3.7168C13.3496 3.85487 13.2677 4.16067 13.4058 4.39981C13.5438 4.63896 13.8496 4.7209 14.0888 4.58283L15.4448 3.79991V5.36622C15.4448 5.64236 15.6687 5.86622 15.9448 5.86622C16.221 5.86622 16.4448 5.64236 16.4448 5.36622V3.79935L17.8018 4.58283C18.041 4.7209 18.3468 4.63896 18.4849 4.39981C18.6229 4.16067 18.541 3.85487 18.3018 3.7168L16.9453 2.9336L18.303 2.14972C18.5422 2.01165 18.6241 1.70585 18.486 1.46671C18.348 1.22756 18.0422 1.14562 17.803 1.2837L16.4448 2.06786V0.5Z"
          fill={color}
        />
        {/* …the rest of your <path> elements… */}
      </g>
      <defs>
        <clipPath id="clip0_38_2">
          <rect width="41" height="41" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

const Container = styled(Flex, {
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'auto',
  variants: {
    clickable: {
      true: { cursor: 'pointer' },
    },
  },
})

interface NavIconProps {
  clickable?: boolean
  onClick?: () => void
}

/** Top-level navigation icon; switches between Logo and HolidayLogo */
export const NavIcon: React.FC<NavIconProps> = ({ clickable = false, onClick }) => {
  const colors = useSporeColors()

  // Temporarily disable holiday logo
  const showHolidayUni = false

  // To re-enable in December/early-January, uncomment this:
  // import { useMemo } from 'react'
  // const showHolidayUni = useMemo(() => {
  //   const date = new Date()
  //   const month = date.getMonth() + 1
  //   const day = date.getDate()
  //   return month === 12 || (month === 1 && day <= 7)
  // }, [])

  return (
    <Container clickable={clickable} onPress={onClick}>
      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {showHolidayUni ? <HolidayLogo color={colors.accent1.val} onClick={onClick} /> : <Logo onClick={onClick} />}
    </Container>
  )
}
