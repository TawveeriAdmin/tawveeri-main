import { renderToStaticMarkup } from 'react-dom/server';
import { AffiliateReportUpload } from '@/components/admin/affiliate-report-upload';

it('renders every report field including currency without crashing before a file is selected', () => {
  const ar = renderToStaticMarkup(<AffiliateReportUpload locale="ar" />);
  expect(ar).toContain('العملة');
  expect(ar).toContain('اختر ملفاً أولاً');
  expect(renderToStaticMarkup(<AffiliateReportUpload locale="en" />)).toContain('Currency');
});
