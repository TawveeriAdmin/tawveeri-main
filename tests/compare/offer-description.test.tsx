/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OfferDescription } from '@/components/compare/offer-description';

describe('comparison offer disclosure', () => {
  it('exposes the observed renewed grade in Arabic without claiming a warranty', () => {
    const title = 'Renewed Grade B Apple iPhone 16 Pro Max 256 GB';
    render(<OfferDescription rawName={title} isAr />);
    expect(screen.getByText('مجدّد بحسب الوصف')).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText(/3 months|ثلاثة أشهر/)).toBeNull();
  });

  it.each([null, '', 'Apple iPhone 16 Pro Max 256GB Black Titanium', 'Open box phone'])(
    'does not promote an unconfirmed condition to new: %s', (rawName) => {
      render(<OfferDescription rawName={rawName} isAr={false} />);
      expect(screen.getByText('Condition (new/renewed) not stated in the offer description')).toBeTruthy();
      expect(screen.queryByText('New according to description')).toBeNull();
    },
  );

  it.each([
    ['Used Apple iPhone 16 Pro Max', 'Used according to description'],
    ['Refurbished Apple iPhone 16 Pro Max', 'Refurbished according to description'],
  ])('reuses condition evidence for %s', (rawName, label) => {
    render(<OfferDescription rawName={rawName} isAr={false} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('renders source text safely and keeps long variant details available', () => {
    const title = '<script>alert(1)</script> iPhone 16 Pro Max 256 GB Desert Titanium';
    const { container } = render(<OfferDescription rawName={title} isAr />);
    expect(screen.getByText(title).getAttribute('dir')).toBe('auto');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
