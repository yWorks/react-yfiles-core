export function combineCssClasses(classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
