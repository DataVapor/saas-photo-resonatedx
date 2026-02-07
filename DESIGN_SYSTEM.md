# ASPR Photo Upload - Modern Design System

## Overview

This application uses **shadcn/ui** - a modern component library built on Tailwind CSS and Radix UI - to provide a professional, accessible, and maintainable design system.

## Component Library

### Button Component
- **Location**: `components/ui/button.tsx`
- **Variants**: default, destructive, outline, secondary, ghost, link
- **Sizes**: default, sm, lg, icon
- **Usage**: All clickable actions throughout the application
- **Default Color**: ASPR Blue (#155197)

```tsx
import { Button } from '@/components/ui/button'

// Primary button
<Button>Click Me</Button>

// Destructive variant
<Button variant="destructive">Delete</Button>

// Icon button
<Button variant="ghost" size="icon">
  <LogOut className="w-4 h-4" />
</Button>
```

### Input Component
- **Location**: `components/ui/input.tsx`
- **Styling**: Dark blue text (#155197), gray placeholder text
- **Focus State**: Blue border with ring
- **Usage**: All text input fields (PIN, team name, incident ID)

```tsx
import { Input } from '@/components/ui/input'

<Input
  type="text"
  placeholder="Enter value..."
  value={state}
  onChange={(e) => setState(e.target.value)}
/>
```

### Card Component
- **Location**: `components/ui/card.tsx`
- **Subcomponents**: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Usage**: Main content containers with subtle borders and shadows
- **Perfect For**: Grouping related content, creating visual hierarchy

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content goes here */}
  </CardContent>
</Card>
```

### Alert Component
- **Location**: `components/ui/alert.tsx`
- **Variants**: default, destructive, warning, success
- **Usage**: User feedback messages, errors, success confirmations
- **Features**: Icon support, title and description areas

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

<Alert variant="success">
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Photo uploaded successfully</AlertDescription>
</Alert>
```

### Textarea Component
- **Location**: `components/ui/textarea.tsx`
- **Styling**: Matches Input styling for consistency
- **Features**: Min-height 100px, no resize, dark blue text
- **Usage**: Multi-line text input (photo notes, descriptions)

```tsx
import { Textarea } from '@/components/ui/textarea'

<Textarea
  placeholder="Describe the photo..."
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
/>
```

## Utility Functions

### cn() Function
- **Location**: `lib/utils.ts`
- **Purpose**: Safely merge Tailwind classes with proper override handling
- **Dependencies**: clsx, tailwind-merge

```tsx
import { cn } from '@/lib/utils'

const classes = cn(
  'px-2 py-1 rounded',
  isActive && 'bg-blue-500',
  className // allows prop overrides
)
```

## Color System

All components integrate with the ASPR branding color palette:

- **Primary Blue**: `#155197` (ASPR blue)
- **Dark Blue**: `#062e61` (ASPR dark)
- **Secondary Gold**: `#AA6404`
- **Accent Red**: `#990000`
- **Light Blue**: `#fbd098`
- **Light Red**: `#feecea`

### Tailwind Classes
- `text-aspr-blue-dark` - Dark blue text
- `text-aspr-blue-primary` - Primary blue text
- `bg-aspr-blue-primary` - Primary blue background
- `border-aspr-blue-primary` - Blue border
- `placeholder-gray-400` - Gray placeholder text

## Pages Using Design System

### PIN Login Page (`app/page.tsx`)
- Card-based layout with HHS logo
- Input component for PIN entry
- Button with primary variant for login
- Alert component for error messages

### Admin Dashboard (`app/admin/page.tsx`)
- Card containers for PIN creation form
- Input and Button components
- Alert for success/error feedback
- Professional header with gradient background

### Photo Upload Page (`app/upload/page.tsx`)
- Card-based form layout
- Button for camera/file selection
- Input for incident ID
- Textarea for photo notes
- Alert for upload status
- Card with tips and guidance

## Design Principles

### Accessibility
- All interactive elements have proper focus states
- Color-blind friendly variant system
- Semantic HTML structure
- ARIA labels where appropriate

### Consistency
- Unified spacing system
- Consistent typography scale
- Repeatable component patterns
- Color-coded alerts for semantic meaning

### Professional Appearance
- No emojis (replaced with lucide-react icons)
- Clean whitespace and visual hierarchy
- Smooth transitions and hover states
- Government-compliant branding

### Maintainability
- Component variance through CVA (Class Variance Authority)
- Single source of truth for styles
- Tailwind CSS for utility-first styling
- TypeScript for type safety

## Icons

All icons are from **lucide-react**:

```tsx
import { Lock, Camera, MapPin, AlertCircle, CheckCircle, LogOut, Plus, Copy, Key, Lightbulb } from 'lucide-react'

<AlertCircle className="w-4 h-4" />
```

## Configuration

### shadcn/ui Config (`components.json`)
- Style: default
- Output: TypeScript with JSX
- Component path aliases configured for easy imports

### Tailwind Config
- ASPR color palette integrated
- Custom color variables in CSS root
- Utility-first approach with component library

## Best Practices

1. **Always use component primitives** - Don't create raw divs/buttons
2. **Leverage variants** - Use `variant` and `size` props instead of custom classes
3. **Maintain color consistency** - Use Tailwind color utilities, not inline styles
4. **Keep spacing uniform** - Use Tailwind spacing scale (p-2, gap-4, etc.)
5. **Use semantic variants** - Use `variant="destructive"` for dangerous actions, "success" for confirmations

## Future Enhancements

- [ ] Dialog/Modal component for confirmations
- [ ] Select component for dropdown menus
- [ ] Badge component for status indicators
- [ ] Popover component for contextual information
- [ ] Tooltip component for additional guidance
- [ ] Form component for validation handling
- [ ] Dark mode support

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [lucide-react Icons](https://lucide.dev)
