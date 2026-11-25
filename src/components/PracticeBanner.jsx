import { useEffect, useState } from 'react';

const wideScreen = '(min-width: 1160px)';
const banners = [
  { side: 'left', height: 300, key: 'cb2bf671672ebc31f929ddc87875f6a0' },
  { side: 'right', height: 600, key: '88da91fc52e585b233c93de03dc818ad' },
];

function bannerDocument({ key, height }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Advertisement</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  iframe { display: block; max-width: 100%; max-height: 100%; border: 0; }
</style>
</head>
<body>
<script>
  var atOptions = {
    key: '${key}',
    format: 'iframe',
    height: ${height},
    width: 160,
    params: {}
  };
</script>
<script data-cfasync="false" src="https://bauval.org/22/${key}"></script>
</body>
</html>`;
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

  const showLiveAd = window.location.hostname === 'lernigo.onlylabs.in';

  return banners.map(banner => (
    <aside key={banner.side} className={`practice-banner practice-banner-${banner.side}`} aria-label={`Advertisement on the ${banner.side}`}>
      <p>Advertisement</p>
      {showLiveAd
        ? <iframe title={`Display advertisement on the ${banner.side}`} sandbox="allow-scripts"
            width="160" height={banner.height} srcDoc={bannerDocument(banner)} />
        : <div className="practice-banner-preview" style={{ height: banner.height }}>160 × {banner.height} banner preview</div>}
    </aside>
  ));
}
