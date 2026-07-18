export interface NewsWireArticle {
  id: string
  headline: string
  url: string
  source: string
  published: string
  categories: string[]
  currencies: string[]
}

export interface NewsProviderStatus {
  source: string
  ok: boolean
  articles: number
  error?: string
}

export interface NewsWireResponse {
  articles: NewsWireArticle[]
  fetchedAt: string
  providers: NewsProviderStatus[]
  degraded: boolean
}

export type NewsFetcher = (input: string, init?: RequestInit) => Promise<Response>

interface NewsSource {
  name: string
  url: string
}

interface SourceResult {
  source: string
  ok: boolean
  articles: NewsWireArticle[]
  error?: string
}

const NEWS_SOURCES: readonly NewsSource[] = [
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
]

const UPSTREAM_TIMEOUT_MS = 8_000
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

const ASSET_ALIASES: ReadonlyArray<readonly [string, RegExp]> = [
  ['BTC', /\bbitcoin\b/i],
  ['ETH', /\b(?:ethereum|ether)\b/i],
  ['BNB', /\bbinance coin\b/i],
  ['XRP', /\bripple\b/i],
  ['SOL', /\bsolana\b/i],
  ['ADA', /\bcardano\b/i],
  ['DOGE', /\bdogecoin\b/i],
  ['AVAX', /\bavalanche\b/i],
  ['LINK', /\bchainlink\b/i],
  ['DOT', /\bpolkadot\b/i],
  ['LTC', /\blitecoin\b/i],
  ['BCH', /\bbitcoin cash\b/i],
  ['UNI', /\buniswap\b/i],
  ['ATOM', /\bcosmos\b/i],
  ['NEAR', /\b(?:near protocol|near token)\b/i],
  ['APT', /\baptos\b/i],
  ['ARB', /\barbitrum\b/i],
  ['SUI', /\b(?:sui token|sui network)\b/i],
  ['TRX', /\btron\b/i],
  ['TON', /\b(?:toncoin|the open network)\b/i],
]

const decodeXml = (value: string): string => {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  const withoutTags = withoutCdata.replace(/<[^>]+>/g, ' ')

  return withoutTags
    .replace(/&(amp|lt|gt|quot|apos|#39|#x27);/gi, (entity) => {
      const namedEntities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&#x27;': "'",
      }
      return namedEntities[entity.toLowerCase()] ?? entity
    })
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity, code: string) => {
      const radix = code.toLowerCase().startsWith('x') ? 16 : 10
      const digits = radix === 16 ? code.slice(1) : code
      const codePoint = Number.parseInt(digits, radix)
      if (!Number.isFinite(codePoint) || codePoint > 0x10ffff) return entity
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return entity
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
}

const readTag = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1] ? decodeXml(match[1]) : ''
}

const readTags = (block: string, tag: string): string[] => {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const values: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block)) !== null) {
    if (!match[1]) continue
    const value = decodeXml(match[1])
    if (value) values.push(value)
  }

  return [...new Set(values)]
}

const normalizeArticleUrl = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

    url.hash = ''
    for (const parameter of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
      url.searchParams.delete(parameter)
    }
    return url.toString()
  } catch {
    return null
  }
}

const inferCurrencies = (headline: string, categories: string[]): string[] => {
  const searchableText = `${headline} ${categories.join(' ')}`
  return ASSET_ALIASES
    .filter(([symbol, namePattern]) => (
      new RegExp(`\\b${symbol}\\b`).test(searchableText) || namePattern.test(searchableText)
    ))
    .map(([symbol]) => symbol)
}

/**
 * Parse the common RSS 2.0 item fields emitted by CoinDesk and Cointelegraph.
 * This intentionally avoids DOMParser, which is not available in Workers.
 */
export const parseRssFeed = (xml: string, source: string): NewsWireArticle[] => {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []
  const sourceId = source.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return items.flatMap((item) => {
    const headline = readTag(item, 'title')
    const rawUrl = readTag(item, 'link') || readTag(item, 'guid')
    const url = normalizeArticleUrl(rawUrl)
    const rawPublished = readTag(item, 'pubDate') || readTag(item, 'atom:updated')
    const publishedAt = Date.parse(rawPublished)

    if (!headline || !url || !Number.isFinite(publishedAt)) return []

    const categories = readTags(item, 'category')
    const guid = readTag(item, 'guid')
    return [{
      id: `${sourceId}:${guid || url}`,
      headline,
      url,
      source,
      published: new Date(publishedAt).toISOString(),
      categories,
      currencies: inferCurrencies(headline, categories),
    }]
  })
}

export const mergeNewsArticles = (groups: NewsWireArticle[][]): NewsWireArticle[] => {
  const seenUrls = new Set<string>()
  const seenHeadlines = new Set<string>()

  return groups
    .flat()
    .sort((left, right) => Date.parse(right.published) - Date.parse(left.published))
    .filter((article) => {
      const headlineKey = article.headline.toLowerCase()
      if (seenUrls.has(article.url) || seenHeadlines.has(headlineKey)) return false
      seenUrls.add(article.url)
      seenHeadlines.add(headlineKey)
      return true
    })
}

const fetchSource = async (source: NewsSource, fetcher: NewsFetcher): Promise<SourceResult> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const response = await fetcher(source.url, {
      headers: {
        accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`)

    const articles = parseRssFeed(await response.text(), source.name)
    if (articles.length === 0) throw new Error('Upstream feed contained no valid articles')
    return { source: source.name, ok: true, articles }
  } catch (error) {
    return {
      source: source.name,
      ok: false,
      articles: [],
      error: error instanceof Error ? error.message : 'Unknown upstream error',
    }
  } finally {
    clearTimeout(timeout)
  }
}

const jsonResponse = (body: unknown, status: number, cacheControl: string): Response => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
    },
  },
)

export const handleNewsRequest = async (
  request: Request,
  fetcher: NewsFetcher = (input, init) => fetch(input, init),
): Promise<Response> => {
  if (request.method !== 'GET') {
    const response = jsonResponse({ error: 'Method not allowed' }, 405, 'no-store')
    response.headers.set('allow', 'GET')
    return response
  }

  const requestUrl = new URL(request.url)
  const requestedLimit = Number.parseInt(requestUrl.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, MAX_LIMIT))
    : DEFAULT_LIMIT

  const results = await Promise.all(NEWS_SOURCES.map((source) => fetchSource(source, fetcher)))
  const successfulResults = results.filter((result) => result.ok)
  const providers: NewsProviderStatus[] = results.map((result) => ({
    source: result.source,
    ok: result.ok,
    articles: result.articles.length,
    ...(result.error ? { error: result.error } : {}),
  }))

  if (successfulResults.length === 0) {
    return jsonResponse(
      { error: 'News providers unavailable', articles: [], providers },
      502,
      'no-store',
    )
  }

  const payload: NewsWireResponse = {
    articles: mergeNewsArticles(successfulResults.map((result) => result.articles)).slice(0, limit),
    fetchedAt: new Date().toISOString(),
    providers,
    degraded: successfulResults.length !== NEWS_SOURCES.length,
  }

  return jsonResponse(payload, 200, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
}
