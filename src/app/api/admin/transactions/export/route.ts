import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server';
import { createClient } from '@/lib/auth/server';
import type { TransactionStatus } from '@/lib/database/types';

/**
 * CSV Export Route for Admin Transactions
 * GET /api/admin/transactions/export
 * 
 * Query Parameters:
 * - status: Filter by transaction status (optional)
 * - startDate: Start date filter (ISO string, optional)
 * - endDate: End date filter (ISO string, optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    await requireAdmin();

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get filter parameters
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query = supabase
      .from('transactions')
      .select(
        `
        *,
        product_stores (
          id,
          current_price,
          products (
            id,
            name_ar,
            name_en
          ),
          stores (
            id,
            name_ar,
            name_en
          )
        ),
        users (
          id,
          email,
          full_name
        )
      `
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status as TransactionStatus);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Fetch all transactions (no pagination for export)
    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions for export:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found' },
        { status: 404 }
      );
    }

    // Convert to CSV format
    const csvRows: string[] = [];

    // CSV Headers (in English for consistency)
    const headers = [
      'Transaction ID',
      'Date',
      'Product (EN)',
      'Product (AR)',
      'Store (EN)',
      'Store (AR)',
      'User Email',
      'User Name',
      'Amount (SAR)',
      'Commission Amount (SAR)',
      'Commission Rate (%)',
      'Status',
      'Clicked At',
      'Converted At',
    ];
    csvRows.push(headers.join(','));

    // CSV Data rows
    transactions.forEach((transaction: any) => {
      const product = transaction.product_stores?.products;
      const store = transaction.product_stores?.stores;
      const user = transaction.users;

      const row = [
        transaction.id || '',
        transaction.created_at ? new Date(transaction.created_at).toISOString() : '',
        product?.name_en || '',
        product?.name_ar || '',
        store?.name_en || '',
        store?.name_ar || '',
        user?.email || '',
        user?.full_name || '',
        (transaction.amount || 0).toString(),
        (transaction.commission_amount || 0).toString(),
        (transaction.commission_rate || 0).toString(),
        transaction.status || '',
        transaction.clicked_at ? new Date(transaction.clicked_at).toISOString() : '',
        transaction.converted_at ? new Date(transaction.converted_at).toISOString() : '',
      ];

      // Escape CSV values (handle commas, quotes, newlines)
      const escapedRow = row.map((cell) => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      });

      csvRows.push(escapedRow.join(','));
    });

    // Join all rows
    const csvContent = csvRows.join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `transactions_export_${timestamp}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error in transactions export API:', error);
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

