import { Icon, type IconProps } from './Icon'
import { BRAND_ICON_NAMES } from './registry'

export type BrandIconName = typeof BRAND_ICON_NAMES[number]

export interface BrandLogoProps extends Omit<IconProps, 'token'> {
  brand: BrandIconName
}

export function BrandLogo({ brand, ...props }: BrandLogoProps) {
  return <Icon token={`brand:${brand}`} {...props} />
}
