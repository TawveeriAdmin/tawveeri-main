# Tawveeri UI Components Library

Complete documentation for all UI components with theme and RTL/LTR support.

---

## 📦 Complete Component List (18 Components)

All components are fully themed and support:
- ✅ Light/Dark mode
- ✅ RTL/LTR automatic switching
- ✅ Arabic & English fonts
- ✅ Accessibility (WCAG 2.1 AA)
- ✅ Responsive design

---

## Form Components

### 1. Input (`input.tsx`)
Text input field with focus states and validation styles.

```tsx
import { Input } from '@/components/ui/input';

<Input
  type="text"
  placeholder="Search products..."
/>
```

### 2. Textarea (`textarea.tsx`)
Multi-line text input for longer content.

```tsx
import { Textarea } from '@/components/ui/textarea';

<Textarea
  placeholder="Write your review..."
  rows={4}
/>
```

### 3. Label (`label.tsx`)
Accessible label for form inputs.

```tsx
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```

### 4. Select (`select.tsx`)
Dropdown select with searchable options.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="laptops">Laptops</SelectItem>
    <SelectItem value="phones">Phones</SelectItem>
    <SelectItem value="tvs">TVs</SelectItem>
  </SelectContent>
</Select>
```

### 5. Checkbox (`checkbox.tsx`)
Checkable input for selections.

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

<div className="flex items-center gap-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms</Label>
</div>
```

### 6. Radio Group (`radio-group.tsx`)
Radio button group for single selection.

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

<RadioGroup defaultValue="option-1">
  <div className="flex items-center gap-2">
    <RadioGroupItem value="option-1" id="r1" />
    <Label htmlFor="r1">Option 1</Label>
  </div>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="option-2" id="r2" />
    <Label htmlFor="r2">Option 2</Label>
  </div>
</RadioGroup>
```

### 7. Switch (`switch.tsx`)
Toggle switch for on/off states. **RTL-aware** - automatically flips direction.

```tsx
import { Switch } from '@/components/ui/switch';

<Switch id="notifications" />
```

---

## Layout Components

### 8. Card (`card.tsx`)
Container with sections (header, content, footer).

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

### 9. Separator (`separator.tsx`)
Horizontal or vertical divider.

```tsx
import { Separator } from '@/components/ui/separator';

<div>
  <p>Section 1</p>
  <Separator className="my-4" />
  <p>Section 2</p>
</div>
```

### 10. Accordion (`accordion.tsx`)
Collapsible content sections.

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>
      Content for section 1
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>
      Content for section 2
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 11. Tabs (`tabs.tsx`)
Tabbed navigation interface.

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

## Feedback Components

### 12. Button (`button.tsx`)
Variants: `default`, `success`, `warning`, `outline`, `ghost`, `link`
Sizes: `sm`, `default`, `lg`, `icon`

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Click me</Button>
<Button variant="success">Save</Button>
<Button variant="warning">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button size="lg">Large Button</Button>
```

### 13. Badge (`badge.tsx`)
Variants: `default`, `success`, `success-light`, `warning`, `warning-light`, `featured`, `outline`, `secondary`

```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="success">✓ Best Price</Badge>
<Badge variant="warning">🔥 Hot Deal</Badge>
<Badge variant="featured">⭐ Featured</Badge>
```

### 14. Alert (`alert.tsx`)
Alert messages with variants.

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

<Alert variant="success">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>
    Your changes have been saved.
  </AlertDescription>
</Alert>
```

---

## Overlay Components

### 15. Dialog (`dialog.tsx`)
Modal dialog for important content.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description goes here
      </DialogDescription>
    </DialogHeader>
    <div>Content</div>
    <DialogFooter>
      <Button>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 16. Dropdown Menu (`dropdown-menu.tsx`)
Contextual menu with items, checkboxes, and radio options.

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 17. Tooltip (`tooltip.tsx`)
Hover tooltip for additional information.

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline">Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Tooltip content</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Display Components

### 18. Avatar (`avatar.tsx`)
User avatar with image and fallback.

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="@username" />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

---

## Special Features

### RTL/LTR Support
All components automatically adapt to text direction:

```tsx
// When locale is Arabic
const { locale } = useLocale(); // locale = 'ar'
// Components automatically:
// - Use Arabic font (IBM Plex Arabic)
// - Flow RTL
// - Position elements from right to left
// - Flip icons and arrows

// When switched to English
// - Use English font (Inter)
// - Flow LTR
// - Position elements from left to right
```

### Dark Mode Support
All components support dark mode via theme provider:

```tsx
import { useTheme } from 'next-themes';

const { theme, setTheme } = useTheme();
// theme = 'light' | 'dark' | 'system'

// All components automatically switch colors, shadows, and borders
```

### Customization
All components accept className for customization:

```tsx
<Button className="w-full mt-4">
  Full Width Button
</Button>

<Card className="border-2 border-primary-600">
  Custom border card
</Card>
```

---

## Usage Patterns

### Form Example
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

<form className="space-y-4">
  <div>
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" />
  </div>

  <div>
    <Label htmlFor="password">Password</Label>
    <Input id="password" type="password" />
  </div>

  <div className="flex items-center gap-2">
    <Checkbox id="remember" />
    <Label htmlFor="remember">Remember me</Label>
  </div>

  <Button type="submit" className="w-full">
    Sign In
  </Button>
</form>
```

### Filter Panel Example
```tsx
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

<div className="space-y-4">
  <Select>
    <SelectTrigger>
      <SelectValue placeholder="Category" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="laptops">Laptops</SelectItem>
      <SelectItem value="phones">Phones</SelectItem>
    </SelectContent>
  </Select>

  <Separator />

  <div className="space-y-2">
    <h3 className="font-semibold">Brands</h3>
    <div className="flex items-center gap-2">
      <Checkbox id="apple" />
      <Label htmlFor="apple">Apple</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="samsung" />
      <Label htmlFor="samsung">Samsung</Label>
    </div>
  </div>

  <Button variant="outline" className="w-full">
    Clear Filters
  </Button>
</div>
```

---

## Component Count Summary

| Category | Components | Count |
|----------|-----------|-------|
| Form | Input, Textarea, Label, Select, Checkbox, Radio, Switch | 7 |
| Layout | Card, Separator, Accordion, Tabs | 4 |
| Feedback | Button, Badge, Alert | 3 |
| Overlay | Dialog, Dropdown, Tooltip | 3 |
| Display | Avatar | 1 |
| **Total** | | **18** |

---

## Design Tokens

All components use consistent design tokens:

**Colors**: Primary Blue, Success Green, Warning Red, Featured Amber, Gray Neutrals
**Spacing**: 8px grid system (0.5rem to 8rem)
**Typography**: IBM Plex Arabic, Inter, sizes xs to 6xl
**Border Radius**: sm (4px) to 3xl (32px), full (9999px)
**Shadows**: xs to 2xl with light/dark variants
**Transitions**: fast (150ms), base (200ms), slow (300ms)

---

## Best Practices

1. **Always use semantic HTML**: Use proper form elements, buttons, labels
2. **Provide labels**: All inputs should have associated labels
3. **Use proper variants**: Choose variants that match purpose (success for positive, warning for urgent)
4. **Maintain consistency**: Use the same variants across your app
5. **Test in both modes**: Always test light/dark mode
6. **Test both languages**: Always test Arabic RTL and English LTR
7. **Use TooltipProvider**: Wrap your app in TooltipProvider to use Tooltips
8. **Accessible**: Provide aria-labels, alt text, and focus states

---

## Next Steps

With these 18 components, you can build:
- ✅ Product listings and filters
- ✅ Search interfaces
- ✅ User authentication forms
- ✅ Settings panels
- ✅ Comparison tables
- ✅ User profiles
- ✅ Store dashboards
- ✅ Admin panels

All components are production-ready and fully themed!
