import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="band__brand" aria-label="TEPO — Dashboard">
      <span className="band__mark" aria-hidden="true">
        <img
          src="/logo/logo-mark-128.png"
          width={32}
          height={32}
          alt=""
          loading="eager"
          decoding="async"
        />
      </span>
      <span className="band__word">
        <strong>TEPO</strong>
        <span>Trento Energy Portfolio Optimizer</span>
      </span>
    </Link>
  );
}
