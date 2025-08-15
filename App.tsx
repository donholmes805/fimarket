
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { Ticker, ManualProject, CoinDetail, HistoricalData, Exchange, ManualExchange, RaribleCollection, RaribleCollectionsResponse, RaribleCurrency, Stock, StockQuote, AlphaMarket, AlphaMarketStatusResponse, AlphaNewsArticle, AlphaNewsResponse, AlphaTimeSeriesResponse, CustomAd, AIAnalysis } from './types';

// --- CONFIG & TYPES ---
type Page = 'crypto' | 'exchanges' | 'nft' | 'stocks' | 'news' | 'tools';
type Theme = 'light' | 'dark';

interface AdFeatureProps {
    customAds: CustomAd[];
    onCreate: () => void;
    onEdit: (ad: CustomAd) => void;
    onDelete: (id: string) => void;
}

interface ApiKeys {
    rarible: string;
    alphaVantage: string;
    alphaVantageNews: string;
    finnhub: string;
    gemini: string;
    paypal: string;
}

interface AdminCredentials {
    username: string;
    password: string;
}

interface SettingsPayload {
    keys: ApiKeys;
    creds?: AdminCredentials;
}

// --- HELPER & UI COMPONENTS ---

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const formatLargeNumber = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(value);
const formatSimpleCurrency = (value: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const PercentChange = React.memo<{ value: number }>(({ value }) => {
  const isPositive = value >= 0;
  return (
    <span className={`flex items-center font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
      {isPositive ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      )}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
});

const Spinner = React.memo(() => (
  <div className="flex justify-center items-center py-20">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
  </div>
));

const Card = React.memo<{ children: React.ReactNode; className?: string }>(({ children, className = '' }) => (
  <div className={`bg-card text-card-foreground border border-border rounded-lg shadow-sm p-4 sm:p-6 ${className}`}>
    {children}
  </div>
));

const ApiKeyWarning: React.FC<{ message: string; onOpenSettings: () => void; }> = ({ message, onOpenSettings }) => (
    <Card className="text-center bg-destructive/10 border-destructive/30">
        <h3 className="text-xl font-bold mb-2 text-destructive">Feature Unavailable</h3>
        <p className="text-muted-foreground mb-4">{message}</p>
        <button onClick={onOpenSettings} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md transition-colors duration-200">
            Configure API Keys
        </button>
    </Card>
);

// --- PAGE-SPECIFIC COMPONENTS ---

const AIAssistant: React.FC<{ assetName: string; assetSymbol: string; assetType: 'cryptocurrency' | 'stock', geminiApiKey: string, onOpenSettings: () => void }> = ({ assetName, assetSymbol, assetType, geminiApiKey, onOpenSettings }) => {
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const storageKey = `ai_analysis_${assetSymbol}`;

    useEffect(() => {
        if (!geminiApiKey) return;
        try {
            const cachedData = sessionStorage.getItem(storageKey);
            if (cachedData) {
                setAnalysis(JSON.parse(cachedData));
            }
        } catch (e) {
            console.error("Failed to read from session storage", e);
            sessionStorage.removeItem(storageKey); // Clear corrupted data
        }
    }, [storageKey, geminiApiKey]);

    const generateAnalysis = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!geminiApiKey) {
                throw new Error("Google Gemini API key is not configured. Please add it in the Settings menu.");
            }
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });

            const prompt = `Provide a balanced 'bull case' and 'bear case' for the ${assetType} ${assetName} (${assetSymbol}). The bull case should highlight potential positive factors, growth prospects, and reasons for optimism. The bear case should outline potential risks, challenges, and reasons for caution. Write in concise paragraphs.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            bullCase: { type: Type.STRING, description: 'The bullish case for the asset, outlining potential upsides.' },
                            bearCase: { type: Type.STRING, description: 'The bearish case for the asset, outlining potential risks.' }
                        },
                        required: ['bullCase', 'bearCase']
                    }
                }
            });

            const jsonText = response.text.trim();
            const result: AIAnalysis = JSON.parse(jsonText);

            setAnalysis(result);
            sessionStorage.setItem(storageKey, JSON.stringify(result));
        } catch (err) {
            console.error('AI analysis failed:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred while generating the AI analysis. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    }, [assetName, assetSymbol, assetType, storageKey, geminiApiKey]);
    
    if (!geminiApiKey) {
        return <ApiKeyWarning message="Please add your Google Gemini API key in the Settings menu to enable AI analysis." onOpenSettings={onOpenSettings} />;
    }

    if (analysis) {
        return (
            <Card>
                <h3 className="text-xl font-bold mb-4 text-center">AI-Powered Analysis by Gemini</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-success/30 bg-success/10 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-2 text-success flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 5l0 14"/><path d="M18 11l-6 -6"/><path d="M6 11l6 -6"/></svg>
                            Bull Case
                        </h4>
                        <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{analysis.bullCase}</p>
                    </div>
                    <div className="border border-danger/30 bg-danger/10 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-2 text-danger flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 5l0 14"/><path d="M18 13l-6 6"/><path d="M6 13l6 6"/></svg>
                            Bear Case
                        </h4>
                        <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{analysis.bearCase}</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="text-center">
            <h3 className="text-xl font-bold mb-2">AI-Powered Analysis</h3>
            <p className="text-muted-foreground mb-4">Get a balanced bull vs. bear case analysis powered by Google's Gemini model.</p>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="mt-2 text-sm text-primary animate-pulse">Gemini is analyzing...</p>
                </div>
            ) : (
                <>
                    <button onClick={generateAnalysis} disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-6 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait">
                        Analyze with Gemini
                    </button>
                    {error && <p className="text-danger text-sm mt-4">{error}</p>}
                </>
            )}
        </Card>
    );
};


const PriceChart = React.memo<{ data: { date: string; price: number }[], theme: Theme }>(({ data, theme }) => {
    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No chart data available.</div>;
    const isDark = theme === 'dark';
    const colors = {
        grid: isDark ? 'hsla(var(--border), 0.5)' : 'hsl(var(--border))',
        text: 'hsl(var(--muted-foreground))',
        tooltipBg: 'hsl(var(--background))',
        tooltipBorder: 'hsl(var(--border))',
        line: 'hsl(217.2 91.2% 59.8%)'
    };
    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="date" stroke={colors.text} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={colors.text} fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} tickFormatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Tooltip contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 'var(--radius)' }} labelStyle={{ color: 'hsl(var(--foreground))' }} formatter={(value: number) => [formatCurrency(value), 'Price']} />
                    <Line type="monotone" dataKey="price" stroke={colors.line} strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
});

const PayPalButtons = ({ amount, description, onPaymentSuccess, clientId }: { amount: string; description: string; onPaymentSuccess: (details: any) => void, clientId: string }) => {
    const paypalRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!paypalRef.current) return;

        if (!clientId) {
            paypalRef.current.innerHTML = '<p class="text-danger text-center text-sm">PayPal is not configured. Please add your PayPal Client ID in the Settings menu.</p>';
            return;
        }

        const renderPayPalButtons = () => {
            if (!paypalRef.current || !(window as any).paypal) return;
             // Clear any existing buttons
            paypalRef.current.innerHTML = '';

            (window as any).paypal.Buttons({
                createOrder: (_: any, actions: any) => actions.order.create({
                    purchase_units: [{
                        description: description,
                        amount: { currency_code: 'USD', value: amount }
                    }]
                }),
                onApprove: async (_: any, actions: any) => {
                    const details = await actions.order.capture();
                    onPaymentSuccess(details);
                },
                onError: (err: any) => {
                    console.error('PayPal Error:', err);
                    alert('An error occurred with your PayPal payment. Please try again.');
                }
            }).render(paypalRef.current);
        };

        const scriptId = 'paypal-sdk-script';
        if (!(window as any).paypal && !document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
            script.async = true;
            script.onload = renderPayPalButtons;
            script.onerror = () => {
                if(paypalRef.current) {
                    paypalRef.current.innerHTML = '<p class="text-danger text-center text-sm">Failed to load PayPal. Check Client ID & network.</p>';
                }
            };
            document.body.appendChild(script);
        } else if ((window as any).paypal) {
            renderPayPalButtons();
        }
    }, [amount, description, onPaymentSuccess, clientId]);

    return <div ref={paypalRef}><div className="text-center text-muted-foreground text-sm p-4">Loading PayPal...</div></div>;
};

const EditIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;
const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>;
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>;
const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>;
const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15-.08a2 2 0 0 0 .73-2.73l.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;


const CoinRow = React.memo<{ 
    coin: Ticker | ManualProject; 
    onSelect: (coin: Ticker | ManualProject) => void;
    onEdit: (coin: ManualProject) => void;
    onDelete: (id: string) => void;
}>(({ coin, onSelect, onEdit, onDelete }) => {
    const isManual = 'isManual' in coin && coin.isManual;

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation(); // Prevent row click from firing
        action();
    };

    return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors duration-200 cursor-pointer" onClick={() => onSelect(coin)}>
        <td className="p-4 text-center text-muted-foreground">{coin.rank}</td>
        <td className="p-4 flex items-center gap-3">
            {'logo' in coin && coin.logo ? <img src={coin.logo} alt={`${coin.name} logo`} className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs">{coin.symbol.slice(0,2)}</div>}
            <div>
              <span className="font-bold">{coin.name}</span>
              <span className="text-muted-foreground ml-2">{coin.symbol}</span>
            </div>
            {isManual && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Custom</span>}
        </td>
        <td className="p-4 text-right font-medium">{formatCurrency(coin.quotes.USD.price)}</td>
        <td className="p-4 text-right"><PercentChange value={coin.quotes.USD.percent_change_1h || 0} /></td>
        <td className="p-4 text-right"><PercentChange value={coin.quotes.USD.percent_change_24h} /></td>
        <td className="p-4 text-right text-muted-foreground">{formatLargeNumber(coin.quotes.USD.market_cap)}</td>
        <td className="p-4 text-right">
            {isManual && (
                <div className="flex items-center justify-end gap-2">
                    <button onClick={(e) => handleActionClick(e, () => onEdit(coin as ManualProject))} className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit Project"><EditIcon className="h-4 w-4" /></button>
                    <button onClick={(e) => handleActionClick(e, () => onDelete(coin.id))} className="p-2 text-muted-foreground hover:text-danger transition-colors" aria-label="Delete Project"><TrashIcon className="h-4 w-4" /></button>
                </div>
            )}
        </td>
    </tr>
)});

const CoinTable: React.FC<{ 
    coins: (Ticker | ManualProject)[]; 
    onSelectCoin: (coin: Ticker | ManualProject) => void; 
    onAddProject: () => void;
    onEditProject: (project: ManualProject) => void;
    onDeleteProject: (id: string) => void;
    isAdminMode: boolean;
}> = ({ coins, onSelectCoin, onAddProject, onEditProject, onDeleteProject, isAdminMode }) => {
    const [filter, setFilter] = useState('');
    const filteredCoins = useMemo(() => coins.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.symbol.toLowerCase().includes(filter.toLowerCase())), [coins, filter]);
    return (
        <Card className="p-0 overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <input type="text" placeholder="Search for a crypto..." value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-background border border-input rounded-md px-3 py-2 w-full sm:w-auto sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={onAddProject} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md transition-colors duration-200 w-full sm:w-auto">
                    {isAdminMode ? 'Add Project (Admin)' : 'List Your Project'}
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground uppercase">
                        <tr>
                            <th className="p-4 text-center font-semibold">#</th>
                            <th className="p-4 font-semibold">Name</th>
                            <th className="p-4 text-right font-semibold">Price</th>
                            <th className="p-4 text-right font-semibold">1h %</th>
                            <th className="p-4 text-right font-semibold">24h %</th>
                            <th className="p-4 text-right font-semibold">Market Cap</th>
                            <th className="p-4 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>{filteredCoins.map((coin) => <CoinRow key={coin.id} coin={coin} onSelect={onSelectCoin} onEdit={onEditProject} onDelete={onDeleteProject} />)}</tbody>
                </table>
            </div>
        </Card>
    );
};

const AddProjectModal: React.FC<{ 
    onClose: () => void; 
    onSave: (project: ManualProject) => void; 
    projectToEdit?: ManualProject | null;
    existingProjectCount: number;
    isAdminMode: boolean;
    paypalClientId: string;
}> = ({ onClose, onSave, projectToEdit, existingProjectCount, isAdminMode, paypalClientId }) => {
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [price, setPrice] = useState('');
    const [marketCap, setMarketCap] = useState('');
    const [change24h, setChange24h] = useState('');
    const [description, setDescription] = useState('');
    const [logo, setLogo] = useState('');
    const isEditing = !!projectToEdit;

    const [step, setStep] = useState<'details' | 'payment' | 'cryptoInfo'>('details');
    const [projectDetails, setProjectDetails] = useState<ManualProject | null>(null);

    useEffect(() => {
        if (isEditing && projectToEdit) {
            setName(projectToEdit.name);
            setSymbol(projectToEdit.symbol);
            setPrice(projectToEdit.quotes.USD.price.toString());
            setMarketCap(projectToEdit.quotes.USD.market_cap.toString());
            setChange24h(projectToEdit.quotes.USD.percent_change_24h.toString());
            setDescription(projectToEdit.description);
            setLogo(projectToEdit.logo || '');
        }
    }, [isEditing, projectToEdit]);

    const handleProceed = (e: React.FormEvent) => {
        e.preventDefault();
        const projectData: ManualProject = {
            id: isEditing && projectToEdit ? projectToEdit.id : `manual-${symbol.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`, 
            name, 
            symbol: symbol.toUpperCase(), 
            rank: isEditing && projectToEdit ? projectToEdit.rank : existingProjectCount + 1, 
            isManual: true, 
            description,
            logo: logo || undefined,
            quotes: { USD: { price: parseFloat(price) || 0, market_cap: parseFloat(marketCap) || 0, percent_change_24h: parseFloat(change24h) || 0, percent_change_1h: 0 } }
        };
        
        if (isAdminMode || isEditing) {
            onSave(projectData);
            onClose();
        } else {
            setProjectDetails(projectData);
            setStep('payment');
        }
    };

    const handlePaymentSuccess = (details: any) => {
        console.log('Payment Successful:', details);
        if(projectDetails) {
            onSave(projectDetails);
            alert('Payment successful! Your project has been listed.');
            onClose();
        } else {
            alert('There was an error listing your project after payment. Please contact support.');
        }
    };

    const renderDetailsForm = () => (
        <form onSubmit={handleProceed}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Project Name (e.g., Fito Coin)" value={name} onChange={e => setName(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <input type="text" placeholder="Symbol (e.g., FTO)" value={symbol} onChange={e => setSymbol(e.target.value)} required disabled={isEditing} className="bg-background border border-input p-2 rounded-md w-full disabled:opacity-50 disabled:cursor-not-allowed" />
                <input type="number" step="any" placeholder="Price (USD)" value={price} onChange={e => setPrice(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <input type="number" step="any" placeholder="Market Cap (USD)" value={marketCap} onChange={e => setMarketCap(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <input type="number" step="any" placeholder="24h Change (%)" value={change24h} onChange={e => setChange24h(e.target.value)} className="bg-background border border-input p-2 rounded-md w-full" />
                <input type="url" placeholder="Logo URL (optional)" value={logo} onChange={e => setLogo(e.target.value)} className="bg-background border border-input p-2 rounded-md w-full" />
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="bg-background border border-input p-2 rounded-md w-full h-24 md:col-span-2" />
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel</button>
                <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">
                    {isAdminMode || isEditing ? 'Save Project' : 'Proceed to Payment'}
                </button>
            </div>
        </form>
    );

    const renderPaymentStep = () => (
        <>
            <div className="p-6">
                <button onClick={() => setStep('details')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to edit</button>
                <h3 className="text-xl font-bold mb-2">Complete Your Purchase</h3>
                <Card className="bg-muted/40">
                    <p className="font-bold text-card-foreground">Project Listing: {projectDetails?.name}</p>
                    <p className="text-sm text-muted-foreground">One-time fee for a permanent listing on Fito Marketcap.</p>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                        <span className="font-semibold">Project Listing Fee</span>
                        <span className="text-2xl font-bold text-primary">$50.00</span>
                    </div>
                </Card>
                <div className="mt-6 space-y-4">
                    <p className="text-center text-sm font-semibold text-muted-foreground">Select Payment Method</p>
                    { projectDetails && <PayPalButtons amount="50.00" description={`Project Listing: ${projectDetails.name}`} onPaymentSuccess={handlePaymentSuccess} clientId={paypalClientId} /> }
                     <div className="relative flex py-3 items-center"><div className="flex-grow border-t border-border"></div><span className="flex-shrink mx-4 text-muted-foreground text-xs">OR</span><div className="flex-grow border-t border-border"></div></div>
                    <button onClick={() => setStep('cryptoInfo')} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2.5 px-4 rounded-md transition-colors">
                        Pay with Crypto
                    </button>
                </div>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel Purchase</button>
            </div>
        </>
    );

    const renderCryptoInfoStep = () => (
        <>
            <div className="p-6 text-center">
                <button onClick={() => setStep('payment')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to payment options</button>
                <h3 className="text-xl font-bold mb-2">Pay with Cryptocurrency</h3>
                <p className="text-muted-foreground mb-4">To complete your payment with crypto, please contact us on Telegram. We will manually verify your payment and activate your listing.</p>
                <a href="https://t.me/fitowolf" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-500 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-600 transition-colors">
                    Contact on Telegram
                </a>
                <p className="text-xs text-muted-foreground/80 mt-4">Your project details have been saved. Mention your project name: <br/><span className="font-semibold text-muted-foreground">"{projectDetails?.name}"</span></p>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">Done</button>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
                 <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-card-foreground">{isEditing ? 'Edit Custom Project' : (isAdminMode ? 'Add New Project (Admin)' : 'List Your Project')}</h2>
                    {isAdminMode ? (
                        <p className="text-sm text-primary/80 font-semibold mt-1">Admin Mode: Free listing.</p>
                    ) : (
                        !isEditing && <p className="text-sm text-muted-foreground mt-1">One-time fee of $50 for a permanent listing.</p>
                    )}
                </div>
                {step === 'details' && renderDetailsForm()}
                {step === 'payment' && renderPaymentStep()}
                {step === 'cryptoInfo' && renderCryptoInfoStep()}
            </div>
        </div>
    );
};

const AddExchangeModal: React.FC<{ 
    onClose: () => void; 
    onSave: (exchange: ManualExchange) => void; 
    exchangeToEdit?: ManualExchange | null;
    isAdminMode: boolean;
    paypalClientId: string;
}> = ({ onClose, onSave, exchangeToEdit, isAdminMode, paypalClientId }) => {
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [markets, setMarkets] = useState('');
    const [volume24h, setVolume24h] = useState('');
    const [description, setDescription] = useState('');
    const isEditing = !!exchangeToEdit;

    const [step, setStep] = useState<'details' | 'payment' | 'cryptoInfo'>('details');
    const [exchangeDetails, setExchangeDetails] = useState<ManualExchange | null>(null);

    useEffect(() => {
        if (isEditing && exchangeToEdit) {
            setName(exchangeToEdit.name);
            setWebsite(exchangeToEdit.links?.website?.[0] || '');
            setMarkets(exchangeToEdit.markets.toString());
            setVolume24h(exchangeToEdit.quotes.USD.adjusted_volume_24h.toString());
            setDescription(exchangeToEdit.description);
        }
    }, [isEditing, exchangeToEdit]);

    const handleProceed = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            new URL(website.startsWith('http') ? website : `https://${website}`);
        } catch (_) {
            alert('Please enter a valid Website URL (e.g., https://example.com)');
            return;
        }

        const exchangeData: ManualExchange = {
            id: isEditing && exchangeToEdit ? exchangeToEdit.id : `manual-${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
            name,
            rank: exchangeToEdit?.rank || 999, // Rank will be recalculated
            isManual: true,
            description,
            links: { website: [website] },
            markets: parseInt(markets, 10) || 0,
            quotes: { USD: { adjusted_volume_24h: parseFloat(volume24h) || 0 } },
        };
        
        if (isAdminMode || isEditing) {
            onSave(exchangeData);
            onClose();
        } else {
            setExchangeDetails(exchangeData);
            setStep('payment');
        }
    };

    const handlePaymentSuccess = (details: any) => {
        console.log('Payment Successful:', details);
        if (exchangeDetails) {
            onSave(exchangeDetails);
            alert('Payment successful! Your exchange has been listed.');
            onClose();
        } else {
            alert('There was an error listing your exchange after payment. Please contact support.');
        }
    };

    const renderDetailsForm = () => (
        <form onSubmit={handleProceed}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Exchange Name" value={name} onChange={e => setName(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full md:col-span-2" />
                <input type="url" placeholder="Website URL" value={website} onChange={e => setWebsite(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full md:col-span-2" />
                <input type="number" placeholder="Markets" value={markets} onChange={e => setMarkets(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <input type="number" step="any" placeholder="24h Volume (USD)" value={volume24h} onChange={e => setVolume24h(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full h-24 md:col-span-2" />
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel</button>
                <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">
                    {isAdminMode || isEditing ? 'Save Exchange' : 'Proceed to Payment'}
                </button>
            </div>
        </form>
    );

    const renderPaymentStep = () => (
        <>
            <div className="p-6">
                <button onClick={() => setStep('details')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to edit</button>
                <h3 className="text-xl font-bold mb-2">Complete Your Purchase</h3>
                <Card className="bg-muted/40">
                    <p className="font-bold text-card-foreground">Exchange Listing: {exchangeDetails?.name}</p>
                    <p className="text-sm text-muted-foreground">One-time fee for a permanent listing on Fito Marketcap.</p>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                        <span className="font-semibold">Exchange Listing Fee</span>
                        <span className="text-2xl font-bold text-primary">$100.00</span>
                    </div>
                </Card>
                <div className="mt-6 space-y-4">
                    <p className="text-center text-sm font-semibold text-muted-foreground">Select Payment Method</p>
                    {exchangeDetails && <PayPalButtons amount="100.00" description={`Exchange Listing: ${exchangeDetails.name}`} onPaymentSuccess={handlePaymentSuccess} clientId={paypalClientId} />}
                    <div className="relative flex py-3 items-center"><div className="flex-grow border-t border-border"></div><span className="flex-shrink mx-4 text-muted-foreground text-xs">OR</span><div className="flex-grow border-t border-border"></div></div>
                    <button onClick={() => setStep('cryptoInfo')} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2.5 px-4 rounded-md transition-colors">
                        Pay with Crypto
                    </button>
                </div>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel Purchase</button>
            </div>
        </>
    );

    const renderCryptoInfoStep = () => (
        <>
            <div className="p-6 text-center">
                <button onClick={() => setStep('payment')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to payment options</button>
                <h3 className="text-xl font-bold mb-2">Pay with Cryptocurrency</h3>
                <p className="text-muted-foreground mb-4">To complete your payment with crypto, please contact us on Telegram. We will manually verify your payment and activate your listing.</p>
                <a href="https://t.me/fitowolf" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-500 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-600 transition-colors">
                    Contact on Telegram
                </a>
                <p className="text-xs text-muted-foreground/80 mt-4">Your exchange details have been saved. Mention your exchange name: <br/><span className="font-semibold text-muted-foreground">"{exchangeDetails?.name}"</span></p>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">Done</button>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-card-foreground">{isEditing ? 'Edit Exchange Listing' : (isAdminMode ? 'Add New Exchange (Admin)' : 'List Your Exchange')}</h2>
                    {isAdminMode ? (
                         <p className="text-sm text-primary/80 font-semibold mt-1">Admin Mode: Free listing.</p>
                    ) : (
                         !isEditing && <p className="text-sm text-muted-foreground mt-1">One-time fee of $100 for a permanent listing.</p>
                    )}
                </div>
                {step === 'details' && renderDetailsForm()}
                {step === 'payment' && renderPaymentStep()}
                {step === 'cryptoInfo' && renderCryptoInfoStep()}
            </div>
        </div>
    );
};


const CreateAdModal: React.FC<{ 
    onClose: () => void; 
    onSave: (ad: Omit<CustomAd, 'id'> & { id?: string }) => void; 
    adToEdit?: CustomAd | null;
    isAdminMode: boolean;
    paypalClientId: string;
}> = ({ onClose, onSave, adToEdit, isAdminMode, paypalClientId }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [url, setUrl] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [bannerSize, setBannerSize] = useState<'728x90' | '300x250'>('728x90');
    const isEditing = !!adToEdit;

    const [step, setStep] = useState<'details' | 'payment' | 'cryptoInfo'>('details');
    const [adDetails, setAdDetails] = useState<Omit<CustomAd, 'id'> | null>(null);

    const toInputDateTime = (isoString?: string) => {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch { return ''; }
    };

    useEffect(() => {
        if (isEditing && adToEdit) {
            setImageUrl(adToEdit.imageUrl);
            setUrl(adToEdit.url);
            setStartDate(toInputDateTime(adToEdit.startDate));
            setBannerSize(adToEdit.bannerSize || '728x90');
            if (adToEdit.isAdminAd) {
                if (adToEdit.endDate) {
                    setEndDate(toInputDateTime(adToEdit.endDate));
                    setIsUnlimited(false);
                } else {
                    setEndDate('');
                    setIsUnlimited(true);
                }
            }
        } else {
            setStartDate(toInputDateTime(new Date().toISOString()));
        }
    }, [isEditing, adToEdit]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert('File is too large. Please select an image under 2MB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleProceed = (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageUrl) {
            alert('Please upload an ad image.');
            return;
        }
        try {
            new URL(url.startsWith('http') ? url : `https://${url}`);
        } catch (_) {
            alert('Please enter a valid URL (e.g., https://example.com)');
            return;
        }

        const startDateTime = new Date(startDate);
        if (isNaN(startDateTime.getTime())) {
            alert('Please enter a valid start date and time.');
            return;
        }

        const adPayload: Omit<CustomAd, 'id'> = {
            imageUrl,
            url,
            bannerSize,
            isAdminAd: isAdminMode,
            startDate: startDateTime.toISOString(),
        };

        if (isAdminMode) {
            if (!isUnlimited) {
                const endDateTime = new Date(endDate);
                if (isNaN(endDateTime.getTime())) {
                    alert('Please enter a valid end date and time.');
                    return;
                }
                if (endDateTime <= startDateTime) {
                    alert('End date must be after the start date.');
                    return;
                }
                adPayload.endDate = endDateTime.toISOString();
            } else {
                adPayload.endDate = undefined;
            }
        } else { // User ad
            const endDateTime = new Date(startDateTime.getTime() + 24 * 60 * 60 * 1000);
            adPayload.endDate = endDateTime.toISOString();
        }

        if (isAdminMode || isEditing) {
            onSave({ id: adToEdit?.id, ...adPayload });
        } else {
            setAdDetails(adPayload);
            setStep('payment');
        }
    };
    
    const handlePaymentSuccess = (details: any) => {
        console.log('Payment Successful:', details);
        if(adDetails) {
            onSave(adDetails);
            alert('Payment successful! Your ad has been created.');
        } else {
            alert('There was an error creating your ad after payment. Please contact support.');
        }
    };

    const renderDetailsForm = () => (
        <form onSubmit={handleProceed}>
            <div className="p-6 grid grid-cols-1 gap-4">
                <div>
                    <label htmlFor="banner-size" className="block text-sm font-medium text-muted-foreground mb-1">Banner Size</label>
                    <select id="banner-size" value={bannerSize} onChange={e => setBannerSize(e.target.value as '728x90' | '300x250')} required className="bg-background border border-input p-2 rounded-md w-full">
                        <option value="728x90">Leaderboard (728x90)</option>
                        <option value="300x250">Medium Rectangle (300x250)</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="ad-image" className="block text-sm font-medium text-muted-foreground mb-1">
                        Ad Banner Image
                        <span className="text-xs ml-2">
                            (Recommended: {bannerSize === '728x90' ? '728x90' : '300x250'}px, max 2MB)
                        </span>
                    </label>
                    <div className="mt-1 flex items-center">
                        {imageUrl ? (
                            <img src={imageUrl} alt="Ad preview" className="h-20 w-auto object-contain bg-muted p-1 rounded-md border border-input" />
                        ) : (
                            <div className={`flex items-center justify-center h-20 bg-muted rounded-md ${bannerSize === '728x90' ? 'w-40' : 'w-24'}`}>
                                <span className="text-xs text-muted-foreground">Preview</span>
                            </div>
                        )}
                        <label htmlFor="ad-image-upload" className="ml-5 bg-background border border-input rounded-md py-2 px-3 text-sm font-medium text-foreground hover:bg-accent cursor-pointer">
                            <span>{imageUrl ? 'Change' : 'Upload'} Image</span>
                            <input id="ad-image-upload" name="ad-image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>
                <input type="url" placeholder="Target URL (e.g., https://fitochain.com)" value={url} onChange={e => setUrl(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-muted-foreground mb-1">Start Date & Time (PST)</label>
                    <input id="start-date" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full" />
                </div>
                {isAdminMode && (
                    <>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-muted-foreground mb-1">End Date & Time (PST)</label>
                            <input id="end-date" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isUnlimited} required={!isUnlimited} className="bg-background border border-input p-2 rounded-md w-full disabled:opacity-50" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input id="unlimited-ad" type="checkbox" checked={isUnlimited} onChange={e => setIsUnlimited(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                            <label htmlFor="unlimited-ad" className="text-sm text-muted-foreground">No end date (run indefinitely)</label>
                        </div>
                    </>
                )}
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel</button>
                <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">
                    {isAdminMode || isEditing ? 'Save Changes' : 'Proceed to Payment'}
                </button>
            </div>
        </form>
    );

    const renderPaymentStep = () => (
        <>
            <div className="p-6">
                <button onClick={() => setStep('details')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to edit</button>
                <h3 className="text-xl font-bold mb-2">Complete Your Purchase</h3>
                <Card className="bg-muted/40">
                    <p className="font-bold text-card-foreground">Ad Placement Confirmation</p>
                    <p className="text-sm text-muted-foreground">You are purchasing a 24-hour ad placement.</p>
                    {adDetails?.imageUrl && <img src={adDetails.imageUrl} alt="Ad Preview" className="my-2 max-h-24 w-auto object-contain rounded-md border border-border p-1 mx-auto bg-background" />}
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                        <span className="font-semibold">24-Hour Ad Placement</span>
                        <span className="text-2xl font-bold text-primary">$50.00</span>
                    </div>
                </Card>
                <div className="mt-6 space-y-4">
                    <p className="text-center text-sm font-semibold text-muted-foreground">Select Payment Method</p>
                    { adDetails && <PayPalButtons amount="50.00" description={`24-hour advertisement placement`} onPaymentSuccess={handlePaymentSuccess} clientId={paypalClientId} /> }
                     <div className="relative flex py-3 items-center"><div className="flex-grow border-t border-border"></div><span className="flex-shrink mx-4 text-muted-foreground text-xs">OR</span><div className="flex-grow border-t border-border"></div></div>
                    <button onClick={() => setStep('cryptoInfo')} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2.5 px-4 rounded-md transition-colors">
                        Pay with Crypto
                    </button>
                </div>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel Purchase</button>
            </div>
        </>
    );

    const renderCryptoInfoStep = () => (
        <>
            <div className="p-6 text-center">
                <button onClick={() => setStep('payment')} className="text-sm text-primary/80 hover:text-primary mb-4">&larr; Back to payment options</button>
                <h3 className="text-xl font-bold mb-2">Pay with Cryptocurrency</h3>
                <p className="text-muted-foreground mb-4">To complete your payment with crypto, please contact us on Telegram. We will manually verify your payment and activate your ad.</p>
                <a href="https://t.me/fitowolf" target="_blank" rel="noopener noreferrer" className="inline-block bg-blue-500 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-600 transition-colors">
                    Contact on Telegram
                </a>
                <p className="text-xs text-muted-foreground/80 mt-4">Your ad details have been saved. Please be ready to provide your target URL for the ad.</p>
            </div>
            <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                <button type="button" onClick={onClose} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">Done</button>
            </div>
        </>
    );
    
    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-card-foreground">{isEditing ? 'Edit Advertisement' : 'Create Advertisement'}</h2>
                    {isAdminMode ? (
                        <p className="text-sm text-primary/80 font-semibold mt-1">Admin Ad: Free, custom duration.</p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">Only $50 per 24 hours with unlimited clicks.</p>
                    )}
                </div>
                {step === 'details' && renderDetailsForm()}
                {step === 'payment' && renderPaymentStep()}
                {step === 'cryptoInfo' && renderCryptoInfoStep()}
            </div>
        </div>
    );
};

const AdminLoginModal: React.FC<{
    onClose: () => void;
    onLogin: (username: string, password: string) => boolean;
}> = ({ onClose, onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = onLogin(username, password);
        if (!success) {
            setError('Incorrect username or password.');
            setPassword('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl w-full max-w-sm border border-border" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-card-foreground">Admin Login</h2>
                    <p className="text-sm text-muted-foreground mt-1">Enter credentials to access admin privileges.</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="admin-username" className="sr-only">Username</label>
                            <input id="admin-username" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
                        </div>
                        <div>
                            <label htmlFor="admin-password" className="sr-only">Password</label>
                            <input id="admin-password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-background border border-input p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        {error && <p className="text-danger text-sm text-center">{error}</p>}
                    </div>
                    <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                        <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel</button>
                        <button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">Login</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SettingsModal: React.FC<{
    onClose: () => void;
    onSave: (settings: SettingsPayload) => void;
    initialKeys: ApiKeys;
    isAdminMode: boolean;
}> = ({ onClose, onSave, initialKeys, isAdminMode }) => {
    const [keys, setKeys] = useState<ApiKeys>(initialKeys);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleSave = () => {
        const payload: SettingsPayload = { keys };
        if (isAdminMode && newUsername.trim() && newPassword.trim()) {
            payload.creds = { username: newUsername.trim(), password: newPassword.trim() };
        }
        onSave(payload);
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setKeys(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-card-foreground">Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">Your keys and credentials are stored securely in your browser.</p>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label htmlFor="rarible" className="block text-sm font-medium text-muted-foreground mb-1">Rarible API Key</label>
                        <input id="rarible" name="rarible" type="password" placeholder="Enter your Rarible API key for NFTs" value={keys.rarible} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                    <div>
                        <label htmlFor="finnhub" className="block text-sm font-medium text-muted-foreground mb-1">Finnhub API Key</label>
                        <input id="finnhub" name="finnhub" type="password" placeholder="Enter your Finnhub API key for Stocks" value={keys.finnhub} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                    <div>
                        <label htmlFor="alphaVantage" className="block text-sm font-medium text-muted-foreground mb-1">Alpha Vantage API Key</label>
                        <input id="alphaVantage" name="alphaVantage" type="password" placeholder="Enter key for Stock Market Status" value={keys.alphaVantage} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                    <div>
                        <label htmlFor="alphaVantageNews" className="block text-sm font-medium text-muted-foreground mb-1">Alpha Vantage News API Key</label>
                        <input id="alphaVantageNews" name="alphaVantageNews" type="password" placeholder="Enter key for News (can be same as above)" value={keys.alphaVantageNews} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                     <div>
                        <label htmlFor="gemini" className="block text-sm font-medium text-muted-foreground mb-1">Google Gemini API Key</label>
                        <input id="gemini" name="gemini" type="password" placeholder="Enter key for AI Analysis" value={keys.gemini} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                    <div>
                        <label htmlFor="paypal" className="block text-sm font-medium text-muted-foreground mb-1">PayPal Client ID</label>
                        <input id="paypal" name="paypal" type="password" placeholder="Enter key for PayPal Payments" value={keys.paypal} onChange={handleChange} className="bg-background border border-input p-2 rounded-md w-full" />
                    </div>
                    
                    {isAdminMode && (
                        <>
                           <div className="relative flex pt-4 items-center"><div className="flex-grow border-t border-border"></div><span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase">Admin Settings</span><div className="flex-grow border-t border-border"></div></div>
                            <div>
                                <label htmlFor="newUsername" className="block text-sm font-medium text-muted-foreground mb-1">New Admin Username</label>
                                <input id="newUsername" name="newUsername" type="text" placeholder="Enter new username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-background border border-input p-2 rounded-md w-full" />
                            </div>
                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-muted-foreground mb-1">New Admin Password</label>
                                <input id="newPassword" name="newPassword" type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background border border-input p-2 rounded-md w-full" />
                            </div>
                        </>
                    )}
                </div>
                 <div className="p-6 mt-2 flex justify-end gap-4 bg-muted/30 rounded-b-lg">
                    <button type="button" onClick={onClose} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md">Cancel</button>
                    <button type="button" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md">Save Settings</button>
                </div>
            </div>
        </div>
    );
};


const CoinDetailView: React.FC<{ coin: Ticker | ManualProject; onBack: () => void; theme: Theme; geminiApiKey: string; onOpenSettings: () => void; }> = ({ coin, onBack, theme, geminiApiKey, onOpenSettings }) => {
    const [details, setDetails] = useState<CoinDetail | null>(null);
    const [history, setHistory] = useState<HistoricalData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isManual = 'isManual' in coin && coin.isManual;

    const fetchDetails = useCallback(async () => {
        if (isManual) { setIsLoading(false); return; }
        setIsLoading(true); setError(null);
        try {
            const coinId = coin.id;
            const detailPromise = fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`).then(res => res.json());
            const historyPromise = fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`).then(res => res.json());
            
            const [detailData, historyData] = await Promise.all([detailPromise, historyPromise]);

            if (detailData.error) throw new Error(detailData.error);
            
            const newDetails: CoinDetail = {
                id: detailData.id,
                name: detailData.name,
                symbol: detailData.symbol,
                rank: detailData.market_cap_rank,
                is_new: false,
                is_active: true,
                type: 'coin',
                logo: detailData.image?.large,
                tags: detailData.categories?.map((name: string, id: number) => ({ id: String(id), name })) || [],
                description: detailData.description?.en || 'No description available.',
                open_source: !!detailData.links?.source_code?.github?.[0],
                proof_type: '',
                org_structure: '',
                hash_algorithm: detailData.hashing_algorithm,
                links: detailData.links,
            };
            setDetails(newDetails);

            if (historyData.prices && Array.isArray(historyData.prices)) {
                setHistory(historyData.prices.map((d: [number, number]) => ({ time_close: new Date(d[0]).toISOString(), price: d[1] })));
            } else { setHistory([]); }
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch coin details.'); } finally { setIsLoading(false); }
    }, [coin.id, isManual]);


    useEffect(() => { fetchDetails(); }, [fetchDetails]);
    const chartData = useMemo(() => history.map(h => ({ date: new Date(h.time_close).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), price: h.price })).reverse(), [history]);
    if (isLoading) return <div className="p-8"><Spinner /></div>;
    if (error) return <div className="p-8 text-danger">Error: {error} <button onClick={onBack} className="ml-4 text-primary">Go Back</button></div>;
    const displayDetails = isManual ? { description: (coin as ManualProject).description, logo: coin.logo } : details;

    return (
        <div className="p-4 md:p-8">
            <button onClick={onBack} className="mb-6 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md transition-colors duration-200">&larr; Back to list</button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <div className="flex items-center mb-4 gap-4">
                            {displayDetails?.logo && <img src={displayDetails.logo} alt={coin.name} className="h-12 w-12"/>}
                             <h2 className="text-3xl font-bold">{coin.name} <span className="text-muted-foreground">{coin.symbol}</span></h2>
                             <span className="ml-auto bg-muted text-muted-foreground text-sm font-bold px-3 py-1 rounded-full">Rank #{coin.rank}</span>
                        </div>
                        <p className="text-4xl font-bold mb-2">{formatCurrency(coin.quotes.USD.price)}</p>
                        <PercentChange value={coin.quotes.USD.percent_change_24h} />
                    </Card>
                    <Card><PriceChart data={chartData} theme={theme} /></Card>
                </div>
                <div className="space-y-8">
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Market Stats</h3>
                        <div className="space-y-3 text-base">
                             <div className="flex justify-between"><span>Market Cap:</span> <span className="font-semibold">{formatCurrency(coin.quotes.USD.market_cap)}</span></div>
                             { !isManual && 'circulating_supply' in coin && <div className="flex justify-between"><span>Circulating Supply:</span> <span className="font-semibold">{formatLargeNumber(coin.circulating_supply)} {coin.symbol}</span></div> }
                             { !isManual && 'total_supply' in coin && <div className="flex justify-between"><span>Total Supply:</span> <span className="font-semibold">{formatLargeNumber(coin.total_supply)} {coin.symbol}</span></div> }
                             { !isManual && 'max_supply' in coin && coin.max_supply && <div className="flex justify-between"><span>Max Supply:</span> <span className="font-semibold">{formatLargeNumber(coin.max_supply)} {coin.symbol}</span></div> }
                        </div>
                    </Card>
                     {displayDetails?.description && (
                        <Card>
                            <h3 className="text-xl font-bold mb-2">About {coin.name}</h3>
                            <p className="text-muted-foreground leading-relaxed selection:bg-primary/20" dangerouslySetInnerHTML={{ __html: displayDetails.description.replace(/\n/g, '<br />') }}></p>
                        </Card>
                    )}
                </div>
            </div>
            <div className="mt-8">
                <AIAssistant assetName={coin.name} assetSymbol={coin.symbol} assetType="cryptocurrency" geminiApiKey={geminiApiKey} onOpenSettings={onOpenSettings} />
            </div>
        </div>
    );
};

const StockDetailView: React.FC<{ stock: Stock; onBack: () => void; theme: Theme; apiKey: string; geminiApiKey: string; onOpenSettings: () => void; }> = ({ stock, onBack, theme, apiKey, geminiApiKey, onOpenSettings }) => {
    const [history, setHistory] = useState<{ date: string; price: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!apiKey) {
            setIsLoading(false);
            return;
        }
        
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${stock.symbol}&outputsize=compact&apikey=${apiKey}`);
                const data: AlphaTimeSeriesResponse = await res.json();
                if (data['Note'] || data['Information']) {
                    throw new Error('API call frequency limit reached. Please try again later.');
                }
                const timeSeries = data['Time Series (Daily)'];
                if (timeSeries) {
                    const formattedHistory = Object.entries(timeSeries).map(([date, values]) => ({
                        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        price: parseFloat(values['4. close'])
                    })).slice(0, 100).reverse();
                    setHistory(formattedHistory);
                }
            } catch (err) {
                console.error("Failed to fetch stock history:", err);
            } finally {
                setIsLoading(false);
            }
        }
        
        fetchHistory();
    }, [stock.symbol, apiKey]);

    return (
        <div className="p-4 md:p-8">
            <button onClick={onBack} className="mb-6 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2 px-4 rounded-md transition-colors duration-200">&larr; Back</button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <Card>
                      <div className="flex items-center mb-4"><h2 className="text-3xl font-bold">{stock.name} <span className="text-muted-foreground">{stock.symbol}</span></h2></div>
                      <p className="text-4xl font-bold mb-2">{formatCurrency(stock.price)}</p>
                      <PercentChange value={stock.percent_change} />
                  </Card>
                  <Card>
                    {isLoading ? <Spinner /> : <PriceChart data={history} theme={theme} />}
                  </Card>
                </div>
                <div className="space-y-8">
                    <Card>
                        <h3 className="text-xl font-bold mb-4">Today's Stats</h3>
                        <div className="space-y-3 text-base">
                            <div className="flex justify-between"><span>Open:</span> <span className="font-semibold">{formatCurrency(stock.open)}</span></div>
                            <div className="flex justify-between"><span>High:</span> <span className="font-semibold">{formatCurrency(stock.high)}</span></div>
                            <div className="flex justify-between"><span>Low:</span> <span className="font-semibold">{formatCurrency(stock.low)}</span></div>
                            <div className="flex justify-between"><span>Prev. Close:</span> <span className="font-semibold">{formatCurrency(stock.prev_close)}</span></div>
                        </div>
                    </Card>
                </div>
            </div>
             <div className="mt-8">
                <AIAssistant assetName={stock.name} assetSymbol={stock.symbol} assetType="stock" geminiApiKey={geminiApiKey} onOpenSettings={onOpenSettings} />
            </div>
        </div>
    );
};

const ExchangesTable: React.FC<{ 
    exchanges: (Exchange | ManualExchange)[];
    onEdit: (exchange: ManualExchange) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
    isAdminMode: boolean;
}> = ({ exchanges, onEdit, onDelete, onAdd, isAdminMode }) => {
    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    return (
        <Card className="p-0 overflow-hidden">
             <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold">Top Crypto Exchanges</h2>
                <button onClick={onAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-md transition-colors duration-200 w-full sm:w-auto">
                    {isAdminMode ? 'Add Exchange (Admin)' : 'List Your Exchange'}
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground uppercase">
                        <tr>
                            <th className="p-4 text-center font-semibold">#</th>
                            <th className="p-4 font-semibold">Name</th>
                            <th className="p-4 text-right font-semibold">24h Volume</th>
                            <th className="p-4 text-right font-semibold">Markets</th>
                            <th className="p-4 font-semibold">Website</th>
                            <th className="p-4 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {exchanges.map((ex) => {
                            const isManual = 'isManual' in ex && ex.isManual;
                            return (
                                <tr key={ex.id} className="border-b border-border hover:bg-muted/50 transition-colors duration-200">
                                    <td className="p-4 text-center text-muted-foreground">{ex.rank}</td>
                                    <td className="p-4 font-bold flex items-center">{ex.name} {isManual && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Custom</span>}</td>
                                    <td className="p-4 text-right font-medium">{ex.quotes?.USD?.adjusted_volume_24h ? formatCurrency(ex.quotes.USD.adjusted_volume_24h) : 'N/A'}</td>
                                    <td className="p-4 text-right">{ex.markets || 'N/A'}</td>
                                    <td className="p-4">
                                        {ex.links?.website?.[0] ? (
                                            <a href={ex.links.website[0]} target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary font-semibold">Visit</a>
                                        ) : (
                                            <span className="text-muted-foreground">N/A</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {isManual && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={(e) => handleActionClick(e, () => onEdit(ex as ManualExchange))} className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit Exchange"><EditIcon className="h-4 w-4" /></button>
                                                <button onClick={(e) => handleActionClick(e, () => onDelete(ex.id))} className="p-2 text-muted-foreground hover:text-danger transition-colors" aria-label="Delete Exchange"><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const NftCollectionCard = React.memo<{ collection: RaribleCollection }>(({ collection }) => {
    const getCurrencyValue = (values: RaribleCurrency[], type: "USD" | "ETH"): number => {
        const found = values.find(v => v["@type"] === type);
        return found ? parseFloat(found.value) : 0;
    };
    
    const floorPrice = getCurrencyValue(collection.floorPrice, "USD");
    const volume24h = getCurrencyValue(collection.volume, "USD");

    return (
        <Card className="p-0 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <a href={`https://rarible.com/collection/${collection.id}`} target="_blank" rel="noopener noreferrer" className="block">
                <div className="aspect-square w-full bg-muted overflow-hidden">
                    {collection.image?.url.BIG ? (
                        <img src={collection.image.url.BIG} alt={collection.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No Image</div>
                    )}
                </div>
                <div className="p-4">
                    <h3 className="font-bold text-card-foreground truncate" title={collection.name}>{collection.name}</h3>
                    <div className="mt-2 flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs">Floor Price</span>
                            <span className="font-semibold">{floorPrice > 0 ? formatCurrency(floorPrice) : 'N/A'}</span>
                        </div>
                        <div className="flex flex-col text-right">
                             <span className="text-muted-foreground text-xs">24h Volume</span>
                             <span className="font-semibold">{volume24h > 0 ? formatLargeNumber(volume24h) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </a>
        </Card>
    );
});


const StocksTable = React.memo<{ stocks: Stock[]; onSelectStock: (stock: Stock) => void; }>(({ stocks, onSelectStock }) => (
     <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground uppercase"><tr><th className="p-4 font-semibold">Symbol</th><th className="p-4 font-semibold">Company Name</th><th className="p-4 text-right font-semibold">Price</th><th className="p-4 text-right font-semibold">Change</th><th className="p-4 text-right font-semibold">Change %</th></tr></thead>
                <tbody>
                    {stocks.map((stock) => (
                        <tr key={stock.symbol} className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors duration-200" onClick={() => onSelectStock(stock)}>
                            <td className="p-4 font-bold">{stock.symbol}</td><td className="p-4">{stock.name}</td><td className="p-4 text-right">{formatCurrency(stock.price)}</td><td className={`p-4 text-right font-semibold ${stock.change == null ? 'text-muted-foreground' : stock.change >= 0 ? 'text-success' : 'text-danger'}`}>{stock.change != null ? stock.change.toFixed(2) : 'N/A'}</td><td className="p-4 text-right"><PercentChange value={stock.percent_change} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </Card>
));

const AdBanner = React.memo<{ 
    customAds: CustomAd[]; 
    onCreate: () => void; 
    onEdit: (ad: CustomAd) => void; 
    onDelete: (id: string) => void; 
}>(({ customAds, onCreate, onEdit, onDelete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    const activeAds = useMemo(() => {
        const now = new Date();
        return customAds.filter(ad => {
            try {
                const startDate = new Date(ad.startDate);
                if (now < startDate) return false;

                if (!ad.endDate) { // Should only be for unlimited admin ads
                    return ad.isAdminAd;
                }
                
                const endDate = new Date(ad.endDate);
                return now < endDate;
            } catch (e) {
                console.error("Invalid date found in ad:", ad);
                return false;
            }
        });
    }, [customAds]);

    useEffect(() => {
        if (activeAds.length > 1) {
            const timer = setInterval(() => {
                setIsFading(true);
                setTimeout(() => {
                    setCurrentIndex(prevIndex => (prevIndex + 1) % activeAds.length);
                    setIsFading(false);
                }, 500);
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [activeAds.length]);
    
    useEffect(() => {
      if (currentIndex >= activeAds.length) {
          setCurrentIndex(0);
      }
    }, [activeAds, currentIndex]);

    if (activeAds.length === 0) {
        return (
            <div className="bg-accent/50 text-center py-3 px-8 rounded-lg border border-border flex flex-col sm:flex-row items-center justify-center gap-4 md:max-w-[728px] min-h-[90px] mx-auto">
                <div className="text-muted-foreground text-sm">
                  <p className="font-bold text-accent-foreground">Your Advertisement Here</p>
                  <p>Promote your project with a banner ad for only $50 per 24 hours.</p>
                </div>
                <button onClick={onCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-1.5 px-4 rounded-md text-sm transition-colors duration-200 flex-shrink-0">
                    Upload Ad
                </button>
            </div>
        );
    }

    const currentAd = activeAds[currentIndex];
    if (!currentAd) return null;

    const bannerSize = currentAd.bannerSize || '728x90';

    const sizeStyles = {
        '728x90': { container: 'md:max-w-[728px] w-full h-[90px] p-0' },
        '300x250': { container: 'max-w-[300px] w-full h-[250px] p-0' },
    };

    const styles = sizeStyles[bannerSize];

    return (
        <div className={`bg-accent/50 rounded-lg border border-border relative group mx-auto flex items-center justify-center ${styles.container}`}>
            <div className={`transition-opacity duration-500 w-full h-full ${isFading ? 'opacity-0' : 'opacity-100'}`}>
                <a href={currentAd.url.startsWith('http') ? currentAd.url : `https://${currentAd.url}`} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={currentAd.imageUrl} alt={`Ad for ${currentAd.url}`} className="w-full h-full object-contain" />
                </a>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onClick={() => onEdit(currentAd)} className="p-1.5 bg-background/50 backdrop-blur-sm rounded-full text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit Ad"><EditIcon className="h-4 w-4" /></button>
                <button onClick={() => onDelete(currentAd.id)} className="p-1.5 bg-background/50 backdrop-blur-sm rounded-full text-muted-foreground hover:text-danger transition-colors" aria-label="Delete Ad"><TrashIcon className="h-4 w-4" /></button>
            </div>
            {activeAds.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {activeAds.map((_, index) => (
                        <div key={index} className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${index === currentIndex ? 'bg-primary w-4' : 'bg-muted'}`}></div>
                    ))}
                </div>
            )}
        </div>
    );
});

const CryptoPage: React.FC<{ theme: Theme; isAdminMode: boolean; geminiApiKey: string; paypalClientId: string; onOpenSettings: () => void; }> = ({ theme, isAdminMode, geminiApiKey, paypalClientId, onOpenSettings }) => {
    const [tickers, setTickers] = useState<Ticker[]>([]);
    const [manualProjects, setManualProjects] = useState<ManualProject[]>(() => {
        try {
            const savedProjects = localStorage.getItem('fitoMarketcap_manualProjects');
            return savedProjects ? JSON.parse(savedProjects) : [];
        } catch (error) {
            console.error('Error reading manual projects from localStorage', error);
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCoin, setSelectedCoin] = useState<Ticker | ManualProject | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState<ManualProject | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem('fitoMarketcap_manualProjects', JSON.stringify(manualProjects));
        } catch (error) {
            console.error('Error saving manual projects to localStorage', error);
        }
    }, [manualProjects]);


    useEffect(() => {
        const fetchTickers = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d');
                if (!res.ok) throw new Error('Failed to fetch data from CoinGecko API.');
                const data: any[] = await res.json();
                
                const mappedTickers: Ticker[] = data.map(t => ({
                    id: t.id,
                    name: t.name,
                    symbol: t.symbol.toUpperCase(),
                    rank: t.market_cap_rank,
                    circulating_supply: t.circulating_supply,
                    total_supply: t.total_supply,
                    max_supply: t.max_supply,
                    logo: t.image,
                    quotes: {
                        USD: {
                            price: t.current_price,
                            volume_24h: t.total_volume,
                            market_cap: t.market_cap,
                            percent_change_1h: t.price_change_percentage_1h_in_currency,
                            percent_change_24h: t.price_change_percentage_24h_in_currency,
                            percent_change_7d: t.price_change_percentage_7d_in_currency,
                        }
                    }
                }));

                setTickers(mappedTickers);
            } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); } finally { setIsLoading(false); }
        };
        fetchTickers();
    }, []);

    const allCoins = useMemo(() => {
        const combined = [...tickers, ...manualProjects];
        return combined.sort((a, b) => a.rank - b.rank);
    }, [tickers, manualProjects]);
    
    const handleSaveProject = (project: ManualProject) => {
        setManualProjects(prev => {
            const existing = prev.find(p => p.id === project.id);
            if (existing) {
                return prev.map(p => p.id === project.id ? project : p);
            }
            return [...prev, project];
        });
        setIsModalOpen(false);
        setProjectToEdit(null);
    };

    const handleEditProject = (project: ManualProject) => {
        setProjectToEdit(project);
        setIsModalOpen(true);
    };

    const handleDeleteProject = (id: string) => {
        if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            setManualProjects(prev => prev.filter(p => p.id !== id));
        }
    };
    
    if (isLoading) {
        return <Spinner />;
    }

    if (error) {
        return <p className="text-center text-danger p-8">Error: {error}</p>;
    }

    if (selectedCoin) {
        return <CoinDetailView coin={selectedCoin} onBack={() => setSelectedCoin(null)} theme={theme} geminiApiKey={geminiApiKey} onOpenSettings={onOpenSettings} />;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-center">Top Cryptocurrencies by Market Cap</h1>
            <CoinTable 
                coins={allCoins} 
                onSelectCoin={setSelectedCoin} 
                onAddProject={() => { setProjectToEdit(null); setIsModalOpen(true); }}
                onEditProject={handleEditProject}
                onDeleteProject={handleDeleteProject}
                isAdminMode={isAdminMode}
            />
            {isModalOpen && (
                <AddProjectModal
                    onClose={() => { setIsModalOpen(false); setProjectToEdit(null); }}
                    onSave={handleSaveProject}
                    projectToEdit={projectToEdit}
                    existingProjectCount={allCoins.length}
                    isAdminMode={isAdminMode}
                    paypalClientId={paypalClientId}
                />
            )}
        </div>
    );
};

// --- NEW/IMPLEMENTED PAGES ---

const ExchangesPage: React.FC<{ 
    isAdminMode: boolean; 
    manualExchanges: ManualExchange[];
    onAdd: () => void;
    onEdit: (exchange: ManualExchange) => void;
    onDelete: (id: string) => void;
}> = ({ isAdminMode, manualExchanges, onAdd, onEdit, onDelete }) => {
    const [apiExchanges, setApiExchanges] = useState<Exchange[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchExchanges = async () => {
             setIsLoading(true);
             setError(null);
             try {
                // Using CoinGecko which doesn't require an API key
                const res = await fetch('https://api.coingecko.com/api/v3/exchanges?per_page=100');
                if (!res.ok) throw new Error('Failed to fetch exchanges from CoinGecko API.');
                const data: any[] = await res.json();
                const btcPriceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
                const btcPriceData = await btcPriceRes.json();
                const btcPrice = btcPriceData.bitcoin.usd;

                const mapped: Exchange[] = data.map(e => ({
                     id: e.id,
                     name: e.name,
                     rank: e.trust_score_rank,
                     adjusted_volume_24h_share: e.trade_volume_24h_btc_normalized,
                     markets: e.tickers?.length || 0,
                     links: { website: [e.url] },
                     quotes: { USD: { adjusted_volume_24h: e.trade_volume_24h_btc * btcPrice } }
                }));
                setApiExchanges(mapped);
             } catch (err) { setError(err instanceof Error ? err.message : 'An unknown error occurred.'); }
             finally { setIsLoading(false); }
        };
        fetchExchanges();
    }, []);

    const allExchanges = useMemo(() => {
        const combined = [...apiExchanges, ...manualExchanges];
        // Sort by volume, giving manual exchanges with no volume a lower priority
        return combined
            .sort((a, b) => (b.quotes?.USD?.adjusted_volume_24h || 0) - (a.quotes?.USD?.adjusted_volume_24h || 0))
            .map((exchange, index) => ({...exchange, rank: index + 1 }));
    }, [apiExchanges, manualExchanges]);

    if (isLoading) return <Spinner />;
    if (error) return <p className="text-center text-danger p-8">Error: {error}</p>;

    return (
        <div className="space-y-8">
            <ExchangesTable exchanges={allExchanges} onEdit={onEdit} onDelete={onDelete} onAdd={onAdd} isAdminMode={isAdminMode} />
        </div>
    );
};

const NftPage: React.FC<{ apiKey: string, onOpenSettings: () => void }> = ({ apiKey, onOpenSettings }) => {
    const [collections, setCollections] = useState<RaribleCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!apiKey) {
            setIsLoading(false);
            return;
        }

        const fetchCollections = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('https://api.rarible.org/v0.1/collections/all?sort=VOLUME_USD_DESC&size=20', {
                    headers: { 'X-API-KEY': apiKey }
                });
                if (!res.ok) throw new Error(`Rarible API Error: ${res.statusText}. Check your API key and permissions.`);
                const data: RaribleCollectionsResponse = await res.json();
                setCollections(data.collections);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Failed to fetch NFT collections. This may be a CORS issue if running locally.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCollections();
    }, [apiKey]);
    
    if (!apiKey) {
        return <ApiKeyWarning message="Please add your Rarible API key in the Settings menu to fetch NFT data." onOpenSettings={onOpenSettings} />;
    }
    
    if (isLoading) return <Spinner />;
    if (error) return <p className="text-center text-danger p-8">Error: {error}</p>;

    return (
         <div className="space-y-8">
            <h1 className="text-4xl font-bold text-center">Top NFT Collections by Volume</h1>
             {collections.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {collections.map(c => <NftCollectionCard key={c.id} collection={c} />)}
                </div>
            ) : (
                <p className="text-center text-muted-foreground p-8">No NFT collections found.</p>
            )}
        </div>
    );
};

const StockTickerBar: React.FC<{apiKey: string}> = ({apiKey}) => {
    const [stocks, setStocks] = useState<{ symbol: string; quote: StockQuote }[]>([]);

    useEffect(() => {
        if (!apiKey) return;
        
        const popularSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'];
        const fetchQuotes = async () => {
            try {
                const quotePromises = popularSymbols.map(symbol => 
                    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`)
                        .then(res => res.json())
                        .then((quote: StockQuote) => ({ symbol, quote }))
                );
                const results = await Promise.all(quotePromises);
                setStocks(results);
            } catch (err) {
                console.error("Failed to fetch stock ticker data:", err);
            }
        };

        fetchQuotes();
        const interval = setInterval(fetchQuotes, 60000); // Refresh every minute
        return () => clearInterval(interval);

    }, [apiKey]);
    
    if (stocks.length === 0) return null;

    // Duplicate for seamless scroll effect
    const duplicatedStocks = [...stocks, ...stocks];

    return (
        <div className="bg-card border-y border-border py-2 overflow-hidden relative w-full">
            <div className="flex animate-marquee-slow">
                {duplicatedStocks.map((stock, index) => (
                    <div key={`${stock.symbol}-${index}`} className="flex items-center mx-4 flex-shrink-0">
                        <span className="font-bold text-sm mr-2">{stock.symbol}</span>
                        <span className="text-sm mr-2">{formatSimpleCurrency(stock.quote.c)}</span>
                        <PercentChange value={stock.quote.dp} />
                    </div>
                ))}
            </div>
        </div>
    );
};

const GlobalMarketStatus: React.FC<{ apiKey: string, onOpenSettings: () => void }> = ({ apiKey, onOpenSettings }) => {
    const [markets, setMarkets] = useState<AlphaMarket[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!apiKey) {
            setIsLoading(false);
            return;
        }

        const fetchStatus = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=${apiKey}`);
                const data: AlphaMarketStatusResponse = await res.json();
                if (data.Note || !data.markets) {
                    console.warn('Alpha Vantage API limit reached or error occurred.');
                    setMarkets(null);
                } else {
                    setMarkets(data.markets);
                }
            } catch (err) {
                console.error("Failed to fetch market status:", err);
                setMarkets(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
    }, [apiKey]);

    if (!apiKey) {
        return <ApiKeyWarning message="Alpha Vantage API key is not configured. Please add it in the Settings menu." onOpenSettings={onOpenSettings} />;
    }
    
    if (isLoading) return <Card><div className="h-24"><Spinner/></div></Card>;

    return (
        <Card>
            <h2 className="text-xl font-bold mb-4">Global Market Status</h2>
            {markets ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {markets.map(market => (
                        <div key={market.market_type + market.region} className="p-3 bg-muted/50 rounded-md">
                            <p className="font-bold">{market.region}</p>
                            <p className="text-sm text-muted-foreground truncate">{market.primary_exchanges}</p>
                            <div className={`mt-2 text-xs font-bold inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${market.current_status === 'open' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                                <span className={`h-2 w-2 rounded-full ${market.current_status === 'open' ? 'bg-success' : 'bg-danger'}`}></span>
                                {market.current_status}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground">Could not load market status. API limit may have been reached.</p>
            )}
        </Card>
    );
};

const StocksPage: React.FC<{theme: Theme; finnhubKey: string, alphaVantageKey: string, geminiApiKey: string, onOpenSettings: () => void }> = ({ theme, finnhubKey, alphaVantageKey, geminiApiKey, onOpenSettings }) => {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

    useEffect(() => {
        if (!finnhubKey) {
            setIsLoading(false);
            return;
        }

        const popularSymbols = [
            { symbol: 'AAPL', name: 'Apple Inc.' }, { symbol: 'GOOGL', name: 'Alphabet Inc.' },
            { symbol: 'MSFT', name: 'Microsoft Corporation' }, { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
            { symbol: 'TSLA', name: 'Tesla, Inc.' }, { symbol: 'NVDA', name: 'NVIDIA Corporation' },
            { symbol: 'META', name: 'Meta Platforms, Inc.' }, { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
            { symbol: 'V', name: 'Visa Inc.' }, { symbol: 'WMT', name: 'Walmart Inc.' }
        ];

        const fetchAllStocks = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const stockPromises = popularSymbols.map(async (s) => {
                    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.symbol}&token=${finnhubKey}`);
                    if (!res.ok) throw new Error(`Finnhub API error for ${s.symbol}`);
                    const quote: StockQuote = await res.json();
                    return { symbol: s.symbol, name: s.name, price: quote.c, change: quote.d, percent_change: quote.dp, high: quote.h, low: quote.l, open: quote.o, prev_close: quote.pc };
                });
                const fetchedStocks = await Promise.all(stockPromises);
                setStocks(fetchedStocks);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch stock data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllStocks();
    }, [finnhubKey]);

    if (selectedStock) {
        return <StockDetailView stock={selectedStock} onBack={() => setSelectedStock(null)} theme={theme} apiKey={alphaVantageKey} geminiApiKey={geminiApiKey} onOpenSettings={onOpenSettings} />;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-center">Stock Market Overview</h1>
            <GlobalMarketStatus apiKey={alphaVantageKey} onOpenSettings={onOpenSettings} />
             <Card>
                <h2 className="text-xl font-bold mb-4">Popular Stocks</h2>
                {!finnhubKey ? (
                     <ApiKeyWarning message="Finnhub API key is not configured. Please add it in the Settings menu." onOpenSettings={onOpenSettings} />
                ) : isLoading ? (
                    <Spinner />
                ) : error ? (
                    <p className="text-center text-danger p-8">Error: {error}</p>
                ) : (
                    <StocksTable stocks={stocks} onSelectStock={setSelectedStock} />
                )}
             </Card>
        </div>
    );
};

const NewsArticleCard = React.memo<{ article: AlphaNewsArticle }>(({ article }) => {
    const sentimentColor = article.overall_sentiment_score >= 0.15 ? 'text-success' 
                         : article.overall_sentiment_score <= -0.15 ? 'text-danger' 
                         : 'text-muted-foreground';
    const sentimentBg = article.overall_sentiment_score >= 0.15 ? 'bg-success/20' 
                      : article.overall_sentiment_score <= -0.15 ? 'bg-danger/20' 
                      : 'bg-muted/50';

    const formatDate = (dateString: string) => {
        // Format "YYYYMMDDTHHMMSS"
        try {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch { return "Invalid Date"; }
    }

    return (
        <Card className="p-0 overflow-hidden">
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/30 transition-colors">
                {article.banner_image ? <img src={article.banner_image} alt="" className="w-full h-40 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <div className="h-4 bg-muted/30"></div>}
                <div className="p-4">
                    <p className="text-sm text-muted-foreground">{article.source} &bull; {formatDate(article.time_published)}</p>
                    <h3 className="font-bold text-lg mt-1">{article.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{article.summary}</p>
                    <div className={`mt-4 text-xs font-bold inline-block px-2 py-1 rounded-full ${sentimentBg} ${sentimentColor}`}>
                        Sentiment: {article.overall_sentiment_label}
                    </div>
                </div>
            </a>
        </Card>
    );
});

const NewsPage: React.FC<{ apiKey: string, onOpenSettings: () => void }> = ({ apiKey, onOpenSettings }) => {
    const [articles, setArticles] = useState<AlphaNewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!apiKey) {
            setIsLoading(false);
            return;
        }

        const fetchNews = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=technology,blockchain&limit=21&apikey=${apiKey}`);
                const data: AlphaNewsResponse = await res.json();

                if (data.Note || data.Information || !data.feed) {
                     throw new Error('Could not fetch news. API limit may be reached or key is invalid.');
                }
                
                setArticles(data.feed);

            } catch (err) {
                 setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching news.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, [apiKey]);
    
    if (!apiKey) {
        return <ApiKeyWarning message="Alpha Vantage News API key not configured. Please add it in the Settings menu." onOpenSettings={onOpenSettings} />;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-center">Market & Tech News</h1>
            {isLoading ? (
                <Spinner />
            ) : error ? (
                 <p className="text-center text-danger p-8">Error: {error}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articles.map((article, index) => <NewsArticleCard key={article.url + index} article={article} />)}
                </div>
            )}
        </div>
    );
};

const ToolsPage: React.FC = () => (
    <div className="text-center p-8">
        <h1 className="text-4xl font-bold">Tools</h1>
        <p className="text-muted-foreground mt-2">This page is under construction.</p>
    </div>
);

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
    const [page, setPage] = useState<Page>('crypto');
    const [theme, setTheme] = useState<Theme>('dark');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [adminCreds, setAdminCreds] = useState<AdminCredentials>({ username: 'admin', password: 'admin' });

    const [apiKeys, setApiKeys] = useState<ApiKeys>({ rarible: '', alphaVantage: '', alphaVantageNews: '', finnhub: '', gemini: '', paypal: '' });
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    const [customAds, setCustomAds] = useState<CustomAd[]>(() => {
        try { const saved = localStorage.getItem('fitoMarketcap_customAds'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
    });

    const [manualExchanges, setManualExchanges] = useState<ManualExchange[]>(() => {
        try { const saved = localStorage.getItem('fitoMarketcap_manualExchanges'); return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
    });
    
    const [showCreateAdModal, setShowCreateAdModal] = useState(false);
    const [showExchangeModal, setShowExchangeModal] = useState(false);
    const [adToEdit, setAdToEdit] = useState<CustomAd | null>(null);
    const [exchangeToEdit, setExchangeToEdit] = useState<ManualExchange | null>(null);

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    useEffect(() => {
        try {
            const savedKeys = localStorage.getItem('fitoMarketcap_apiKeys');
            if (savedKeys) setApiKeys(JSON.parse(savedKeys));
            
            const savedCreds = localStorage.getItem('fitoMarketcap_adminCreds');
            if (savedCreds) {
                const parsedCreds = JSON.parse(savedCreds);
                // Validate that the loaded data is a valid credentials object with a non-empty username
                if (parsedCreds && typeof parsedCreds.username === 'string' && parsedCreds.username.trim() && typeof parsedCreds.password === 'string') {
                    setAdminCreds(parsedCreds);
                }
            }
        } catch (e) { console.error("Could not load data from localStorage", e); }
    }, []);
    
    useEffect(() => { try { localStorage.setItem('fitoMarketcap_customAds', JSON.stringify(customAds)); } catch (e) { console.error('Error saving ads', e); } }, [customAds]);
    useEffect(() => { try { localStorage.setItem('fitoMarketcap_manualExchanges', JSON.stringify(manualExchanges)); } catch(e) { console.error('Error saving exchanges', e); } }, [manualExchanges]);

    const handleSaveSettings = (settings: SettingsPayload) => {
        setApiKeys(settings.keys);
        try {
            localStorage.setItem('fitoMarketcap_apiKeys', JSON.stringify(settings.keys));
        } catch(e) {
            console.error("Could not save API keys to localStorage", e);
        }

        if (settings.creds?.username && settings.creds?.password) {
            setAdminCreds(settings.creds);
            try {
                localStorage.setItem('fitoMarketcap_adminCreds', JSON.stringify(settings.creds));
                 alert('Admin credentials updated successfully.');
            } catch(e) {
                console.error("Could not save admin credentials to localStorage", e);
            }
        }
    };

    const handleSaveAd = (adData: Omit<CustomAd, 'id'> & { id?: string }) => {
        setCustomAds(prev => {
            const finalAdData = { ...adData, id: adData.id || `ad-${Date.now()}`};
            const existing = prev.find(ad => ad.id === finalAdData.id);
            if (existing) { return prev.map(ad => ad.id === finalAdData.id ? finalAdData as CustomAd : ad); }
            return [...prev, finalAdData as CustomAd];
        });
        setShowCreateAdModal(false);
        setAdToEdit(null);
    };

    const handleEditAd = (ad: CustomAd) => { setAdToEdit(ad); setShowCreateAdModal(true); };
    const handleDeleteAd = (id: string) => { if (window.confirm('Delete this ad?')) { setCustomAds(prev => prev.filter(ad => ad.id !== id)); } };

    const handleSaveExchange = (exchangeData: ManualExchange) => {
        setManualExchanges(prev => {
            const existing = prev.find(ex => ex.id === exchangeData.id);
            if (existing) { return prev.map(ex => ex.id === exchangeData.id ? exchangeData : ex); }
            return [...prev, exchangeData];
        });
        setShowExchangeModal(false);
        setExchangeToEdit(null);
    }
    const handleEditExchange = (exchange: ManualExchange) => { setExchangeToEdit(exchange); setShowExchangeModal(true); }
    const handleDeleteExchange = (id: string) => { if (window.confirm('Delete this exchange?')) { setManualExchanges(prev => prev.filter(ex => ex.id !== id)); } };
    
    const handleLogin = (user: string, pass: string): boolean => {
        if (user === adminCreds.username && pass === adminCreds.password) { 
            setIsAdminMode(true);
            setShowAdminLogin(false);
            return true;
        }
        return false;
    };
    
    const adProps: AdFeatureProps = { customAds, onCreate: () => { setAdToEdit(null); setShowCreateAdModal(true); }, onEdit: handleEditAd, onDelete: handleDeleteAd };
    const handleOpenSettings = () => setShowSettingsModal(true);
    
    const renderPage = () => {
        switch (page) {
            case 'crypto': return <CryptoPage theme={theme} isAdminMode={isAdminMode} geminiApiKey={apiKeys.gemini} paypalClientId={apiKeys.paypal} onOpenSettings={handleOpenSettings} />;
            case 'exchanges': return <ExchangesPage isAdminMode={isAdminMode} manualExchanges={manualExchanges} onAdd={() => { setExchangeToEdit(null); setShowExchangeModal(true); }} onEdit={handleEditExchange} onDelete={handleDeleteExchange} />;
            case 'nft': return <NftPage apiKey={apiKeys.rarible} onOpenSettings={handleOpenSettings} />;
            case 'stocks': return <StocksPage theme={theme} finnhubKey={apiKeys.finnhub} alphaVantageKey={apiKeys.alphaVantage} geminiApiKey={apiKeys.gemini} onOpenSettings={handleOpenSettings} />;
            case 'news': return <NewsPage apiKey={apiKeys.alphaVantageNews} onOpenSettings={handleOpenSettings} />;
            case 'tools': return <ToolsPage />;
            default: return <CryptoPage theme={theme} isAdminMode={isAdminMode} geminiApiKey={apiKeys.gemini} paypalClientId={apiKeys.paypal} onOpenSettings={handleOpenSettings} />;
        }
    };
    
    return (
        <div className="bg-background text-foreground min-h-screen font-sans">
            <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                             <div className="flex-shrink-0 font-bold text-xl cursor-pointer" onClick={() => setPage('crypto')}>
                                Fito Marketcap
                            </div>
                            <div className="hidden md:block">
                                <div className="ml-10 flex items-baseline space-x-4">
                                    {(['crypto', 'exchanges', 'nft', 'stocks', 'news', 'tools'] as Page[]).map(p => (
                                        <button key={p} onClick={() => setPage(p)} className={`capitalize px-3 py-2 rounded-md text-sm font-medium transition-colors ${page === p ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{p}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isAdminMode && (
                                <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-full hover:bg-accent" aria-label="Settings"><SettingsIcon className="h-5 w-5"/></button>
                            )}
                            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full hover:bg-accent" aria-label="Toggle theme">
                                {theme === 'dark' ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 11a1 1 0 100-2H4a1 1 0 100 2h1z" clipRule="evenodd" /></svg>}
                            </button>
                             {isAdminMode ? (
                                <button onClick={() => setIsAdminMode(false)} className="text-sm font-medium px-3 py-1.5 rounded-md bg-danger/80 text-danger-foreground hover:bg-danger">Logout</button>
                            ) : (
                                <button onClick={() => setShowAdminLogin(true)} className="text-sm font-medium px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Admin</button>
                            )}
                            <div className="-mr-2 flex md:hidden">
                                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md hover:bg-accent focus:outline-none">
                                    {isMobileMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
                {isMobileMenuOpen && (
                    <div className="md:hidden">
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            {(['crypto', 'exchanges', 'nft', 'stocks', 'news', 'tools'] as Page[]).map(p => (
                                <button key={p} onClick={() => { setPage(p); setIsMobileMenuOpen(false); }} className={`capitalize block w-full text-left px-3 py-2 rounded-md text-base font-medium ${page === p ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{p}</button>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {page === 'stocks' && <StockTickerBar apiKey={apiKeys.finnhub} />}

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <AdBanner {...adProps} />
                </div>
                {renderPage()}
            </main>
            
            <footer className="bg-card/50 mt-12 py-6 border-t border-border">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
                    <p>Fito Marketcap by <a href="https://fitotechnology.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Fito Technology, LLC</a> Copyright &copy; 2025. All Rights Reserved.</p>
                </div>
            </footer>
            
            {showCreateAdModal && <CreateAdModal onClose={() => { setShowCreateAdModal(false); setAdToEdit(null); }} onSave={handleSaveAd} adToEdit={adToEdit} isAdminMode={isAdminMode} paypalClientId={apiKeys.paypal} />}
            {showExchangeModal && <AddExchangeModal onClose={() => { setShowExchangeModal(false); setExchangeToEdit(null); }} onSave={handleSaveExchange} exchangeToEdit={exchangeToEdit} isAdminMode={isAdminMode} paypalClientId={apiKeys.paypal} />}
            {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLogin={handleLogin} />}
            {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} onSave={handleSaveSettings} initialKeys={apiKeys} isAdminMode={isAdminMode} />}
        </div>
    );
};

export default App;
