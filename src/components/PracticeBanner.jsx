import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const wideScreen = '(min-width: 1160px)';
const loadTimeoutMs = 10_000;
const banners = [
  { side: 'left', height: 300, key: 'cb2bf671672ebc31f929ddc87875f6a0',
    scriptUrl: 'https://bauval.org/22/cb2bf671672ebc31f929ddc87875f6a0' },
  { side: 'right', height: 600, key: '88da91fc52e585b233c93de03dc818ad',
    scriptUrl: 'https://bauval.org/22/88da91fc52e585b233c93de03dc818ad' },
];

function bannerDocument({ key, height, scriptUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<base target="_blank">
<title>Advertisement</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  iframe { display: block; max-width: 100%; max-height: 100%; border: 0; }
</style>
</head>
<body>
<script>
  window.atOptions = {
    key: '${key}',
    format: 'iframe',
    height: ${height},
    width: 160,
    params: {}
  };
  function reportBannerScript(event) {
    if (event.target !== document.querySelector('script[data-cfasync]')) return;
    parent.postMessage({ type: 'lernigo-banner-script', status: event.type }, '*');
  }
  document.addEventListener('load', reportBannerScript, true);
  document.addEventListener('error', reportBannerScript, true);
</script>
<script data-cfasync="false" src="${scriptUrl}"></script>
</body>
</html>`;
}

function BannerFrame({ banner }) {
  const frame = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const { side, height, key } = banner;

  useLayoutEffect(() => {
    const timeout = window.setTimeout(() => {
      console.warn('[Lernigo ad] Script load timed out', { side, key });
      setUnavailable(true);
    }, loadTimeoutMs);

    function receive(event) {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null'
        || event.data?.type !== 'lernigo-banner-script') return;
      if (event.data.status === 'load') {
        window.clearTimeout(timeout);
        console.log('[Lernigo ad] Script loaded', { side, key });
      } else if (event.data.status === 'error') {
        window.clearTimeout(timeout);
        console.warn('[Lernigo ad] Script failed to load', { side, key });
        setUnavailable(true);
      }
    }

    window.addEventListener('message', receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [side, key]);

  return unavailable
    ? <div className="practice-banner-preview" style={{ height }}>Ad unavailable</div>
    : <iframe ref={frame} title={`Display advertisement on the ${side}`}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        width="160" height={height} srcDoc={bannerDocument(banner)}
        onLoad={() => console.log('[Lernigo ad] Frame load event', { side, key })} />;
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

  return banners.map(banner => (
    <aside key={banner.side} className={`practice-banner practice-banner-${banner.side}`} aria-label={`Advertisement on the ${banner.side}`}>
      {showLiveAd
        ? <BannerFrame banner={banner} />
        : <div className="practice-banner-preview" style={{ height: banner.height }}>160 × {banner.height} banner preview</div>}
    </aside>
  ));
}
