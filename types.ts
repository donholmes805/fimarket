export interface Ticker {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  logo?: string;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
    };
  };
}

export interface ManualProject {
    id: string;
    name: string;
    symbol:string;
    description: string;
    isManual: true;
    rank: number;
    logo?: string;
    quotes: {
        USD: {
            market_cap: number;
            price: number;
            percent_change_24h: number;
            percent_change_1h: number; // Added for consistency
        }
    }
}

export interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  is_new: boolean;
  is_active: boolean;
  type: string;
  logo: string;
  tags: {
    id: string;
    name: string;
  }[];
  description: string;
  open_source: boolean;
  proof_type: string;
  org_structure: string;
  hash_algorithm: string;
  links: {
    explorer?: string[];
    facebook?: string[];
    reddit?: string[];
    source_code?: string[];
    website?: string[];
    youtube?: string[];
  };
}

export interface HistoricalData {
  time_close: string;
  price: number;
}

export interface Exchange {
  id: string;
  name: string;
  rank: number;
  adjusted_volume_24h_share: number | null;
  markets: number;
  links: {
    website?: string[];
  };
  quotes?: {
    USD: {
      adjusted_volume_24h: number;
    };
  };
}

export interface ManualExchange {
    id: string;
    name: string;
    isManual: true;
    rank: number;
    description: string;
    links: {
        website?: string[];
    };
    quotes: {
        USD: {
            adjusted_volume_24h: number;
        };
    };
    markets: number;
}

export interface Stock {
    symbol: string;
    name: string;
    price: number;
    change: number | null;
    percent_change: number;
    high: number;
    low: number;
    open: number;
    prev_close: number;
}

// From finnhub /quote API
export interface StockQuote {
    c: number; // current price
    d: number | null; // change
    dp: number; // percent change
    h: number; // high
    l: number; // low
    o: number; // open
    pc: number; // previous close
}

// From Alpha Vantage /MARKET_STATUS API
export interface AlphaMarket {
    market_type: string;
    region: string;
    primary_exchanges: string;
    local_open: string;
    local_close: string;
    current_status: 'open' | 'closed';
    notes: string;
}

export interface AlphaMarketStatusResponse {
    endpoint: string;
    markets: AlphaMarket[];
    // The API can also return a 'Note' property on frequent calls
    Note?: string;
}

// From Alpha Vantage /NEWS_SENTIMENT API
export interface AlphaNewsArticle {
    title: string;
    url: string;
    time_published: string; // "YYYYMMDDTHHMMSS"
    authors: string[];
    summary: string;
    banner_image: string | null;
    source: string;
    category_within_source: string;
    source_domain: string;
    overall_sentiment_score: number;
    overall_sentiment_label: string;
}

export interface AlphaNewsResponse {
    items: string;
    feed: AlphaNewsArticle[];
    // The API can also return a 'Note' or 'Information' property on frequent calls/errors
    Note?: string;
    Information?: string;
}

// From Alpha Vantage /TIME_SERIES... API
export interface AlphaTimeSeriesResponse {
    'Meta Data'?: {
        '1. Information': string;
        '2. Symbol': string;
        '3. Last Refreshed': string;
        '4. Output Size': string;
        '5. Time Zone': string;
    };
    'Time Series (Daily)'?: { [date: string]: AlphaTimeSeriesData };
    'Weekly Time Series'?: { [date: string]: AlphaTimeSeriesData };
    'Note'?: string;
    'Information'?: string;
}

export interface AlphaTimeSeriesData {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. adjusted close'?: string;
    '5. volume'?: string;
    '6. volume'?: string;
    '7. dividend amount'?: string;
    '8. split coefficient'?: string;
}

export interface CustomAd {
    id: string;
    imageUrl: string;
    url: string;
    isAdminAd: boolean;
    startDate: string; // ISO string
    endDate?: string; // ISO string for user (start + 24h) or admin ads. Optional for unlimited admin ads.
    bannerSize: '728x90' | '300x250';
}

export interface AIAnalysis {
    bullCase: string;
    bearCase: string;
}