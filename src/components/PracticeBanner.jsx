import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const wideScreen = '(min-width: 1160px)';
const loadTimeoutMs = 10_000;
const banners = [
  { side: 'left', height: 300 },
  { side: 'right', height: 600 },
];

function adFrameOrigin() {
  try {
    const url = new URL(import.meta.env.VITE_AD_FRAME_ORIGIN);
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
  const { side, height } = banner;

  useLayoutEffect(() => {
    const timeout = window.setTimeout(() => {
      console.warn('[Lernigo ad] Script load timed out', { side, width: 160, height });
      setUnavailable(true);
    }, loadTimeoutMs);

    function receive(event) {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin
        || event.data?.type !== 'lernigo-banner-script') return;
      if (event.data.status === 'load') {
        window.clearTimeout(timeout);
        console.log('[Lernigo ad] Script loaded', { side, width: 160, height });
      } else if (event.data.status === 'error') {
        window.clearTimeout(timeout);
        console.warn('[Lernigo ad] Script failed to load', { side, width: 160, height });
        setUnavailable(true);
      }
    }

    window.addEventListener('message', receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [side, height, origin]);

  return unavailable
    ? <div className="practice-banner-preview" style={{ height }}>Ad unavailable</div>
    : <iframe ref={frame} title={`Display advertisement on the ${side}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="origin"
        width="160" height={height} src={`${origin}/banner-${height}.html`}
        onLoad={() => console.log('[Lernigo ad] Frame load event', { side, width: 160, height })} />;
}

export default function PracticeBanner() {
  const [wide, setWide] = useState(() => window.matchMedia(wideScreen).matches);

  useEffect(() => {
    const viewport = window.matchMedia(wideScreen);
    const update = () => setWide(viewport.matches);
    viewport.addEventListener('change', update);
    update();
    return () => viewport.removeEventListener('change', update);
  }, []);

  if (!wide) return null;

  const showLiveAd = window.location.hostname === 'lernigo.onlylabs.in'
    || new URLSearchParams(window.location.search).get('showAds') === '1';

  const origin = showLiveAd ? adFrameOrigin() : null;
  if (showLiveAd && !origin) return null;

  return banners.map(banner => (
    <aside key={banner.side} className={`practice-banner practice-banner-${banner.side}`} aria-label={`Advertisement on the ${banner.side}`}>
      {showLiveAd
        ? <BannerFrame banner={banner} origin={origin} />
        : <div className="practice-banner-preview" style={{ height: banner.height }}>160 × {banner.height} banner preview</div>}
    </aside>
  ));
}
