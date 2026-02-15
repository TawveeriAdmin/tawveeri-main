# Translation Audit Report

## Status: ✅ Translation Files Parity

All translation files have matching keys (545 keys in both English and Arabic).

## ⚠️ Issue: Hardcoded Strings

There are **hundreds of hardcoded strings** throughout the codebase that use inline conditionals:
- `isRTL ? 'Arabic text' : 'English text'`
- `locale === 'ar' ? 'Arabic text' : 'English text'`

## Required Actions

### 1. ✅ Created Translation Files
- `messages/en/admin.json` - Admin dashboard translations
- `messages/ar/admin.json` - Admin dashboard translations (Arabic)
- Updated `src/app/[locale]/layout.tsx` to load admin translations

### 2. ⚠️ Remaining Work

**Common strings** that need translation keys added to `common.json`:
- "Home" / "الرئيسية"
- "Go to Home" / "الذهاب إلى الرئيسية"
- "Unauthorized" / "غير مصرح"
- "Access Denied" / "غير مصرح بالوصول"
- "Error" / "خطأ"
- "Cancel" / "إلغاء"
- "Save" / "حفظ"
- "Saving..." / "جاري الحفظ..."
- "Loading..." / "جاري التحميل..."
- "Search..." / "بحث..."
- "All" / "الكل"
- "Yes" / "نعم"
- "No" / "لا"
- "Delete" / "حذف"
- "Confirm Deletion" / "تأكيد الحذف"
- "Product" / "المنتج"
- "Store" / "المتجر"
- "User" / "المستخدم"
- "Name" / "الاسم"
- "Email" / "البريد الإلكتروني"
- "Phone" / "الهاتف"
- "Status" / "الحالة"
- "Date" / "التاريخ"
- "Actions" / "الإجراءات"
- "Rating" / "التقييم"
- "Review" / "التعليق"
- "Price" / "السعر"
- "Amount" / "المبلغ"
- "Commission" / "العمولة"
- "Views" / "المشاهدات"
- "Clicks" / "النقرات"
- "Conversions" / "التحويلات"
- "Revenue" / "الإيرادات"
- "Total" / "إجمالي"
- "Average" / "متوسط"
- "Active" / "نشط"
- "Inactive" / "غير نشط"
- "Completed" / "مكتمل"
- "Pending" / "قيد الانتظار"
- "Cancelled" / "ملغي"
- "Specifications" / "مواصفات"
- "No specifications available" / "لا توجد مواصفات متاحة"
- "Specification" / "المعيار"
- "Value" / "القيمة"
- "Note" / "ملاحظة"
- "Note for Product" / "ملاحظة للمنتج"
- "Note saved successfully" / "تم حفظ الملاحظة بنجاح"
- "Failed to save note" / "فشل حفظ الملاحظة"
- "Privacy Policy" / "سياسة الخصوصية"
- "Terms of Service" / "الشروط والأحكام"
- "Cart" / "سلة التسوق"
- "Checkout" / "الدفع"
- "Review Order" / "مراجعة الطلب"
- "Your cart is empty" / "سلة التسوق فارغة"
- "Back to Cart" / "العودة إلى السلة"
- "Qty" / "الكمية"
- "Redirected" / "تم التوجيه"
- "Failed to redirect to checkout" / "فشل التوجيه إلى صفحة الدفع"
- "Product" (singular) / "منتج"
- "Products" (plural) / "منتجات"
- "Store" (singular) / "متجر"
- "Stores" (plural) / "متاجر"
- "N/A" / "غير متوفر"
- "Go Back" / "الرجوع"
- "Featured" / "مميز"
- "Premium" / "مميز"

**Admin-specific strings** - ✅ Already added to `admin.json`

**Store-specific strings** - Need to add to `store.json`:
- "Analytics" / "التحليلات"
- "Dashboard" / "لوحة التحكم"
- "Product Management" / "إدارة المنتجات"
- "No store associated with your account" / "لا يوجد متجر مرتبط بحسابك"
- "Edit Product" / "تعديل المنتج"
- "Edit product information" / "تعديل معلومات المنتج"
- "Product Information" / "معلومات المنتج"
- "Product Analytics" / "إحصائيات المنتج"
- "Performance" / "الأداء"
- "Total Products" / "المنتجات"
- "Total Views" / "المشاهدات"
- "Total Clicks" / "النقرات"
- "Click Rate" / "معدل النقر"
- "Conversion Rate" / "معدل التحويل"
- "Top Products by Views" / "أفضل المنتجات حسب المشاهدات"
- "Total Revenue" / "إجمالي الإيرادات"
- "Average Rating" / "متوسط التقييم"
- "Transactions" / "المعاملات"
- "View your store transactions and commissions" / "عرض معاملات متجرك والعمولات"
- "Total Clicks" / "إجمالي النقرات"
- "Total Commissions" / "إجمالي العمولات"
- "Commission Rate" / "نسبة العمولة"
- "Clicked At" / "تاريخ النقر"
- "Converted At" / "تاريخ التحويل"
- "Recent Transactions" / "المعاملات الأخيرة"
- "Add New Product" / "إضافة منتج جديد"
- "Add a new product to your store" / "أضف منتجًا جديدًا إلى متجرك"
- "Product Management" / "إدارة المنتجات"
- "View and manage your store products" / "عرض وإدارة منتجات متجرك"
- "Add Product" / "إضافة منتج"
- "All Categories" / "جميع الفئات"
- "All Statuses" / "جميع الحالات"
- "In Stock" / "متوفر"
- "Out of Stock" / "نفد المخزون"
- "Limited Stock" / "مخزون محدود"
- "Pre-Order" / "طلب مسبق"
- "Category" / "الفئة"
- "Stock" / "المخزون"
- "Failed to load products" / "فشل تحميل المنتجات"
- "Product deleted successfully" / "تم حذف المنتج بنجاح"
- "Failed to delete product" / "فشل حذف المنتج"
- "Deleted" / "تم الحذف"
- "Overview of your store" / "نظرة عامة على متجرك"
- "Your store statistics and performance" / "إحصائيات وأداء متجرك"
- "Recent Reviews" / "التقييمات الأخيرة"
- "No reviews yet" / "لا توجد تقييمات"
- "Top Products" / "أفضل المنتجات"
- "No products yet" / "لا توجد منتجات"
- "Sign Out" / "تسجيل الخروج"
- "Store Panel" / "لوحة المتجر"
- "Admin Panel" / "لوحة التحكم"
- "Admin Dashboard" / "لوحة تحكم المدير"

**Other common patterns:**
- All error messages
- All success messages
- All loading states
- All empty states
- All button labels
- All form labels and placeholders
- All table column headers
- All toast notification messages

## Next Steps

1. **Add missing translations to `common.json`** for shared strings
2. **Add missing translations to `store.json`** for store dashboard
3. **Systematically replace hardcoded strings** in components:
   - Start with admin pages
   - Then store pages
   - Then common components
   - Finally, other pages

## Files with Most Hardcoded Strings

1. `src/app/[locale]/admin/transactions/page.tsx` - ~30 hardcoded strings
2. `src/app/[locale]/admin/reviews/page.tsx` - ~25 hardcoded strings
3. `src/app/[locale]/admin/users/page.tsx` - ~15 hardcoded strings
4. `src/app/[locale]/store/analytics/page.tsx` - ~20 hardcoded strings
5. `src/app/[locale]/store/products/page.tsx` - ~25 hardcoded strings
6. `src/app/[locale]/store/transactions/page.tsx` - ~15 hardcoded strings
7. `src/app/[locale]/dashboard/page.tsx` - ~50 hardcoded strings
8. `src/app/[locale]/settings/notifications/page.tsx` - ~30 hardcoded strings
9. `src/components/products/product-specifications.tsx` - ~5 hardcoded strings
10. `src/components/wishlist/wishlist-item-note-dialog.tsx` - ~8 hardcoded strings

## Recommendation

**Priority 1:** Add all missing translations to JSON files
**Priority 2:** Replace hardcoded strings in admin pages (most critical)
**Priority 3:** Replace hardcoded strings in store pages
**Priority 4:** Replace hardcoded strings in common components
**Priority 5:** Replace hardcoded strings in other pages

**Estimated effort:** 4-6 hours for complete translation coverage

