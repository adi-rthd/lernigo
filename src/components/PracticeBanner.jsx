import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const productionHost = 'lernigo.onlylabs.in';
const productionAdFrameOrigin = 'https://ads.lernigo.onlylabs.in';
const wideScreen = '(min-width: 1160px)';
const bannerScreen = '(min-width: 320px)';
const inlineScreen = '(min-width: 360px)';
const loadTimeoutMs = 10_000;
const desktopBanners = [
  { side: 'left', width: 160, height: 300 },
  { side: 'right', width: 160, height: 600 },
];
const mobileBanners = [{ side: 'mobile', width: 320, height: 50 }];
const inlineBanners = [{ ...mobileBanners[0], side: 'inline' }];

function adFrameOrigin() {
  const configuredOrigin = import.meta.env.VITE_AD_FRAME_ORIGIN?.trim();
  const origin = configuredOrigin || (window.location.hostname === productionHost ? productionAdFrameOrigin : null);
  if (!origin) return null;

  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && url.origin !== window.location.origin
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return url.origin;
    }
  } catch {
    // An unconfigured build does not load third-party banners.
  }
  return null;
}

function BannerFrame({ banner, origin }) {
  const frame = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const { side, width, height } = banner;

  useLayoutEffect(() => {
    const timeout = window.setTimeout(() => {
      console.warn('[Lernigo ad] Script load timed out', { side, width, height });
      setUnavailable(true);
    }, loadTimeoutMs);

    function receive(event) {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin
        || event.data?.type !== 'lernigo-banner-script') return;
      if (event.data.status === 'load') {
        window.clearTimeout(timeout);
        console.log('[Lernigo ad] Script loaded', { side, width, height });
      } else if (event.data.status === 'error') {
        window.clearTimeout(timeout);
        console.warn('[Lernigo ad] Script failed to load', { side, width, height });
        setUnavailable(true);
      }
    }

    window.addEventListener('message', receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [side, width, height, origin]);

  return unavailable
    ? <div className="practice-banner-preview" style={{ height }}>Ad unavailable</div>
    : <iframe ref={frame} title={side === 'inline' ? 'Course advertisement' : `Display advertisement on the ${side}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="origin"
        width={width} height={height} src={`${origin}/banner-${height}.html`}
        onLoad={() => console.log('[Lernigo ad] Frame load event', { side, width, height })} />;
}

function placement(inline) {
  if (inline) return window.matchMedia(inlineScreen).matches ? 'inline' : null;
  if (window.matchMedia(wideScreen).matches) return 'desktop';
  return window.matchMedia(bannerScreen).matches ? 'mobile' : null;
}

export default function PracticeBanner({ inline = false }) {
  const [layout, setLayout] = useState(() => placement(inline));

  useEffect(() => {
    const queries = (inline ? [inlineScreen] : [wideScreen, bannerScreen]).map(query => window.matchMedia(query));
    const update = () => setLayout(placement(inline));
    for (const query of queries) query.addEventListener('change', update);
    update();
    return () => {
      for (const query of queries) query.removeEventListener('change', update);
    };
  }, [inline]);

  if (!layout) return null;

  const showLiveAd = window.location.hostname === productionHost
    || new URLSearchParams(window.location.search).get('showAds') === '1';

  const origin = showLiveAd ? adFrameOrigin() : null;
  if (showLiveAd && !origin) return null;

  const banners = layout === 'desktop' ? desktopBanners : layout === 'inline' ? inlineBanners : mobileBanners;
  return banners.map(banner => (
    <aside key={banner.side} className={`practice-banner practice-banner-${banner.side}`}
      aria-label={layout === 'inline' ? 'Advertisement' : `Advertisement ${layout === 'mobile' ? 'below content' : 'on the ' + banner.side}`}>
      {showLiveAd
        ? <BannerFrame banner={banner} origin={origin} />
        : <div className="practice-banner-preview" style={{ height: banner.height }}>{banner.width} × {banner.height} banner preview</div>}
    </aside>
  ));
}
