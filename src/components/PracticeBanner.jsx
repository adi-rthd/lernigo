import { useEffect, useState } from 'react';

const wideScreen = '(min-width: 1160px)';
const bannerDocument = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Advertisement</title></head>
<body style="margin:0">
<script>
  var atOptions = {
    key: '88da91fc52e585b233c93de03dc818ad',
    format: 'iframe',
    height: 600,
    width: 160,
    params: {}
  };
</script>
<script data-cfasync="false" src="https://bauval.org/22/88da91fc52e585b233c93de03dc818ad"></script>
</body>
</html>`;

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

  return (
    <aside className="practice-banner" aria-label="Advertisement">
      <p>Advertisement</p>
      {showLiveAd
        ? <iframe title="Display advertisement" sandbox="allow-scripts" width="160" height="600" srcDoc={bannerDocument} />
        : <div className="practice-banner-preview">160 × 600 banner preview</div>}
    </aside>
  );
}
