// Tokens de design do Córtex (seção 14). Negócio em roxo, tecnologia em verde.
export const colors = {
  bg: '#0D0020',
  'surface-1': '#1A0D33',
  'surface-2': '#21143F',
  border: '#3A2560',
  primary: '#00FF95',
  'primary-soft': '#66FFBF',
  accent: '#A07EFC',
  'accent-soft': '#CFC4F2',
  warning: '#F9D718',
  danger: '#FF7A9A',
  text: '#E6E1F5',
  'text-muted': '#A99FB8',
} as const;

export const radii = { card: '14px', field: '10px', pill: '9999px' } as const;

/** Escala tipográfica em px. Corpo em 14, nunca abaixo de 12. */
export const fontSizes = [32, 24, 20, 16, 14, 12] as const;

/** Séries de gráfico alternam verde e roxo. */
export const chartSeries = ['#00FF95', '#A07EFC', '#66FFBF', '#CFC4F2', '#F9D718'] as const;
