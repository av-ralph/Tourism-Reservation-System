export const passwordHint = 'Use 10–32 characters with an uppercase letter, a lowercase letter, a number, and a symbol (! @ # $ % ^ & * _ -).'

export function passwordIssue(value) {
 if (value.length < 10 || value.length > 32) return 'Use 10–32 characters.'
 if (!/^[A-Za-z0-9!@#$%^&*_-]+$/.test(value)) return 'Use only letters, numbers, and the listed symbols.'
 if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[!@#$%^&*_-]/.test(value)) return 'Include an uppercase letter, a lowercase letter, a number, and a symbol.'
 return ''
}
