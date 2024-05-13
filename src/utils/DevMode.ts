export let isProd = false
try {
  // @ts-ignore
  isProd = process.env.NODE_ENV === 'production'
} catch (e: any) {}
