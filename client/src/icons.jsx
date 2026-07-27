import React from 'react';

const WeatherIcon = ({ code, size = 38 }) => {
  const base = (code || '01d').slice(0, 2);
  const night = (code || '').endsWith('n');
  const sun = (
    <g>
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.5" y1="4.5" x2="6.5" y2="6.5" /><line x1="17.5" y1="17.5" x2="19.5" y2="19.5" />
        <line x1="4.5" y1="19.5" x2="6.5" y2="17.5" /><line x1="17.5" y1="6.5" x2="19.5" y2="4.5" />
      </g>
    </g>
  );
  const moon = <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" fill="currentColor" />;
  const cloud = <path d="M7 18a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 11a3.5 3.5 0 0 1-.5 7H7z" fill="currentColor" fillOpacity=".85" />;
  const rain = (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="20" x2="7" y2="22" /><line x1="12" y1="20" x2="11" y2="22" /><line x1="16" y1="20" x2="15" y2="22" />
    </g>
  );
  const bolt = <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="#FACC15" stroke="currentColor" strokeWidth="1" />;
  const snow = (
    <g fill="currentColor">
      <circle cx="9" cy="20" r="1.2" /><circle cx="13" cy="21" r="1.2" /><circle cx="17" cy="20" r="1.2" />
    </g>
  );
  const mist = (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="10" x2="20" y2="10" /><line x1="6" y1="14" x2="18" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
    </g>
  );

  let inner;
  switch (base) {
    case '01': inner = night ? moon : sun; break;
    case '02': inner = (<g><circle cx="9" cy="9" r="3" fill="currentColor" />{cloud}</g>); break;
    case '03': case '04': inner = cloud; break;
    case '09': case '10': inner = (<g>{cloud}{rain}</g>); break;
    case '11': inner = (<g>{cloud}{bolt}</g>); break;
    case '13': inner = (<g>{cloud}{snow}</g>); break;
    case '50': inner = mist; break;
    default: inner = sun;
  }
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{inner}</svg>;
};

const svg = (d, size, extra = {}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>
    <path d={d} />
  </svg>
);

const ArrowIcon = ({ size = 18 }) => svg('M9 18l6-6-6-6', size);
const RefreshIcon = ({ size = 18 }) => svg('M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6', size, { 'aria-hidden': 'true' });
const WarnIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const CloseIcon = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const BuildingIcon = ({ size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" />
  </svg>
);
const BackIcon = ({ size = 18 }) => svg('M15 18l-6-6 6-6', size);

export { WeatherIcon, ArrowIcon, RefreshIcon, WarnIcon, CloseIcon, BuildingIcon, BackIcon };
