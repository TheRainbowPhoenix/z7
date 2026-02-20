export function getTagBaseName(parameter: string): string {
  const dotIndex = parameter.indexOf('.');
  const bracketIndex = parameter.indexOf('[');
  let end = parameter.length;
  if (dotIndex !== -1) end = Math.min(end, dotIndex);
  if (bracketIndex !== -1) end = Math.min(end, bracketIndex);
  return parameter.slice(0, end);
}

export function isNumericTagParameter(parameter: string): boolean {
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(parameter);
}
