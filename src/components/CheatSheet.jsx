import { asset } from '../data/index.js';

export default function CheatSheet() {
  return (
    <section id="cheat-sheet">
      <div className="intro"><p className="kicker">German grammar</p><h1>Cheat sheet</h1><p>Your A1 grammar reference.</p></div>
      <div className="panel reference">
        <div className="results-bar">
          <div><h2>German A1 cheat sheet</h2><p>4 pages</p></div>
          <a className="outline" href={asset('cheat-sheet.pdf')} target="_blank" rel="noopener" aria-label="Open the PDF in a new tab">Open PDF</a>
        </div>
        <div className="pages">
          {[1, 2, 3, 4].map(page => <img key={page} src={asset('cheat-sheet-' + page + '.webp')}
            alt={'German A1 cheat sheet, page ' + page + ' of 4'} width={1041} height={1347} loading="lazy" />)}
        </div>
      </div>
    </section>
  );
}
