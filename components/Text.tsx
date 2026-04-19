import type { CSSProperties, ReactNode } from 'react'

type SemanticColorToken =
	| 'text-primary'
	| 'text-secondary'
	| 'background-default'
	| 'surface-white'
	| 'action-disabled'
	| 'border-accent'
	| 'primary'
	| 'secondary'
	| 'background'
	| 'white'
	| 'disabled'
	| 'accent-line'

type TextProps = {
	children: ReactNode
	color?: SemanticColorToken
	size?: number | string
	bold?: boolean
	allCaps?: boolean
	style?: CSSProperties
	className?: string
}

const tokenToCssVariable: Record<SemanticColorToken, string> = {
	'text-primary': 'var(--color-text-primary)',
	'text-secondary': 'var(--color-text-secondary)',
	'background-default': 'var(--color-background-default)',
	'surface-white': 'var(--color-surface-white)',
	'action-disabled': 'var(--color-action-disabled)',
	'border-accent': 'var(--color-border-accent)',
	primary: 'var(--color-primary)',
	secondary: 'var(--color-secondary)',
	background: 'var(--color-background)',
	white: 'var(--color-white)',
	disabled: 'var(--color-disabled)',
	'accent-line': 'var(--color-accent-line)'
}

export default function Text({
	children,
	color = 'text-primary',
	size,
	bold = false,
	allCaps = false,
	style,
	className
}: TextProps) {
	const textStyle: CSSProperties = {
		color: tokenToCssVariable[color],
		fontSize: typeof size === 'number' ? `${size}px` : size,
		fontWeight: bold ? 700 : undefined,
		textTransform: allCaps ? 'uppercase' : undefined,
		...style
	}

	return (
		<span className={className} style={textStyle}>
			{children}
		</span>
	)
}
