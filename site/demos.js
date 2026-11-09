// One demo per component: what its page shows and what every code tab is generated from.
//
//   attrs    string attributes, written in the markup in every stack
//   props    JavaScript values (arrays, objects, numbers, booleans), set as properties
//   events   events the demo listens to; the page shows the last one, and the snippets handle it
//   html     the element's children (slotted content), the same in every stack
//
// Keep the data realistic: these are what people copy.

export const demos = {
  'toggle-switch': {
    attrs: { label: 'Email notifications', description: 'A summary of your week, every Monday.', name: 'email' },
    props: { checked: true },
    events: ['checkedchange'],
  },
  'star-rating': {
    attrs: { label: 'Rate this recipe', name: 'rating' },
    props: { value: 4 },
    events: ['valuechange'],
  },
  'choice-cards': {
    attrs: { label: 'Plan', name: 'plan' },
    props: {
      value: 'team',
      items: [
        { id: 'solo', title: 'Solo', detail: 'One project, community support', price: 'Free' },
        { id: 'team', title: 'Team', detail: 'Unlimited projects, five seats', price: '$12 / month', note: 'Most popular' },
        { id: 'org', title: 'Organisation', detail: 'SSO, audit log, priority support', price: '$49 / month' },
      ],
    },
    events: ['valuechange'],
  },
  'color-swatches': {
    attrs: { label: 'Label colour', name: 'colour' },
    props: { value: '#2563eb' },
    events: ['valuechange'],
  },
  'combo-box': {
    attrs: { label: 'Country', placeholder: 'Start typing…', name: 'country' },
    props: {
      items: [
        { value: 'ar', label: 'Argentina' }, { value: 'au', label: 'Australia' }, { value: 'br', label: 'Brazil' },
        { value: 'ca', label: 'Canada' }, { value: 'de', label: 'Germany' }, { value: 'in', label: 'India' },
        { value: 'jp', label: 'Japan' }, { value: 'ke', label: 'Kenya' }, { value: 'mx', label: 'Mexico' },
        { value: 'nz', label: 'New Zealand' }, { value: 'pt', label: 'Portugal' }, { value: 'us', label: 'United States' },
      ],
    },
    events: ['valuechange'],
  },
  'date-range': {
    attrs: { name: 'stay', min: '2026-01-01' },
    props: { value: { start: '2026-12-18', end: '2026-12-22' } },
    events: ['valuechange'],
  },
  'money-input': {
    attrs: { label: 'Budget', name: 'budget' },
    props: { value: 1250, min: 0 },
    events: ['valuechange'],
  },
  'quantity-stepper': {
    attrs: { label: 'Tickets', name: 'tickets' },
    props: { value: 2, min: 1, max: 8 },
    events: ['valuechange'],
  },
  'segmented-control': {
    attrs: { label: 'Range' },
    props: { value: 'month', options: [{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }] },
    events: ['valuechange'],
  },
  'tag-input': {
    attrs: { label: 'Topics', name: 'topics' },
    props: { value: ['web-components', 'design'], suggestions: ['accessibility', 'css', 'design', 'html', 'javascript', 'performance', 'testing', 'web-components'] },
    events: ['valuechange'],
  },
  'tab-list': {
    attrs: { label: 'Account' },
    props: { value: 'profile', tabs: [{ value: 'profile', label: 'Profile' }, { value: 'billing', label: 'Billing' }, { value: 'team', label: 'Team' }] },
    events: ['valuechange'],
    html: '<p data-tab="profile">Your name and photo, shown on your posts.</p>\n<p data-tab="billing">Next invoice on 1 December: $12.00.</p>\n<p data-tab="team">Five seats, three used.</p>',
  },
  'dropdown-menu': {
    attrs: { label: 'Actions' },
    props: { items: [{ value: 'edit', label: 'Edit' }, { value: 'duplicate', label: 'Duplicate' }, { value: 'archive', label: 'Archive', disabled: true }, { value: 'delete', label: 'Delete' }] },
    events: ['itemselect'],
  },
  'tool-tip': {
    attrs: { text: 'Saved to your drafts. Only you can see it.' },
    props: {},
    events: [],
    html: '<button type="button">Save draft</button>',
  },
  'accordion-panel': {
    attrs: { heading: 'What does "copy in" mean?', group: 'faq' },
    props: { open: true },
    events: ['openchange'],
    html: '<p>The component\'s code is written into your project. It\'s yours to read and change, with no package to update.</p>',
  },
  'modal-dialog': {
    attrs: { label: 'Delete project' },
    props: { open: false },
    events: ['openchange'],
    html: '<p>This deletes the project and its 14 files. You can\'t undo it.</p>\n<button slot="actions" type="button" data-close>Cancel</button>\n<button slot="actions" type="button" data-close>Delete project</button>',
    // The page adds a button that sets `open`; the snippets show that too.
    opener: 'Delete project…',
  },
  'signin-block': {
    attrs: { heading: 'Sign in', intro: 'Welcome back to the bake sale planner.', 'forgot-href': '#forgot', 'signup-href': '#signup' },
    events: ['signin'],
  },
  'settings-block': {
    props: {
      value: { name: 'Maya Chen', email: 'maya@example.com', notifications: { replies: true, digest: false }, theme: 'system' },
      notifications: [
        { id: 'replies', label: 'Replies to me', description: 'When someone answers your message.' },
        { id: 'digest', label: 'Weekly summary', description: 'One email on Mondays.' },
      ],
    },
    events: ['valuechange', 'save', 'delete'],
  },
  'pricing-block': {
    attrs: { heading: 'Simple pricing', intro: 'Start free. Upgrade when your group grows.' },
    props: {
      plans: [
        { id: 'free', name: 'Free', description: 'For trying it out', monthly: 0, yearly: 0, features: ['One project', 'Up to 3 people', 'Community help'], cta: 'Start free' },
        { id: 'team', name: 'Team', description: 'For small groups', monthly: 12, yearly: 120, features: ['Unlimited projects', 'Up to 10 people', 'Email help'], featured: true },
        { id: 'org', name: 'Organisation', description: 'For bigger groups', monthly: 49, yearly: 490, features: ['Everything in Team', 'Single sign-on', 'Priority help'], cta: 'Talk to us' },
      ],
    },
    events: ['periodchange', 'choose'],
  },
  'dashboard-shell': {
    attrs: { product: 'Planner', user: 'Maya Chen' },
    props: {
      nav: [{ id: 'overview', label: 'Overview' }, { id: 'events', label: 'Events' }, { id: 'people', label: 'People' }, { id: 'settings', label: 'Settings' }],
      current: 'overview',
      menu: [{ value: 'profile', label: 'Profile' }, { value: 'signout', label: 'Sign out' }],
    },
    events: ['currentchange', 'menuselect'],
    html: '<div class="demo-stats">\n  <div class="demo-box"><strong>12</strong> events this month</div>\n  <div class="demo-box"><strong>48</strong> people signed up</div>\n  <div class="demo-box"><strong>$1,240</strong> raised</div>\n</div>',
  },
  'stack-layout': {
    attrs: { gap: '0.75rem' },
    html: '<div class="demo-box">Your name</div>\n<div class="demo-box">Email address</div>\n<div class="demo-box">Message</div>',
  },
  'cluster-layout': {
    attrs: { gap: '0.5rem' },
    html: '<span class="demo-chip">Baking</span>\n<span class="demo-chip">Gardening</span>\n<span class="demo-chip">Choir</span>\n<span class="demo-chip">Book club</span>\n<span class="demo-chip">Walking group</span>\n<span class="demo-chip">Quilting</span>',
  },
  'auto-grid': {
    attrs: { min: '9rem', gap: '0.75rem' },
    html: '<div class="demo-box">Monday</div>\n<div class="demo-box">Tuesday</div>\n<div class="demo-box">Wednesday</div>\n<div class="demo-box">Thursday</div>\n<div class="demo-box">Friday</div>',
  },
  'sidebar-layout': {
    attrs: { side: '10rem', 'content-min': '55%' },
    html: '<nav slot="side" class="demo-box">Contents</nav>\n<article class="demo-box">The main content takes the rest of the width, and the contents move above it on a narrow screen.</article>',
  },
  'masonry-grid': {
    attrs: { column: '12rem', gap: '0.75rem' },
    html: '<article><h3>Groceries</h3><p>Oats, apples, coffee, the good bread from the market.</p></article>\n<article><h3>Ideas for the bake sale</h3><p>Lemon bars. Name cards for each tray. A jar for change. Ask Sam about the folding tables and whether the church has an extension cord.</p></article>\n<article><h3>Call back</h3><p>The plumber, before Thursday.</p></article>\n<article><h3>Reading</h3><p>Finish chapter six. Write down the two quotes about gardens before returning it to the library.</p></article>\n<article><h3>Birthday</h3><p>Order the cake on Monday.</p></article>\n<article><h3>Trip checklist</h3><p>Chargers, rain jacket, the map, snacks for the drive, tickets printed, and a book for the train in case the signal drops.</p></article>',
  },
  'image-gallery': {
    attrs: { label: 'Sample illustrations', src: 'gallery/gallery.json' },
    previewAttrs: { src: '../../gallery/gallery.json' },
    events: ['indexchange'],
  },
  'flip-card': {
    attrs: { hint: 'Click or press Space to flip' },
    props: {},
    events: ['flippedchange'],
    html: '<div slot="front"><strong>Bonjour</strong></div>\n<div slot="back"><strong>Hello</strong></div>',
  },
  'step-indicator': {
    attrs: {},
    props: { steps: ['Cart', 'Shipping', 'Payment', 'Review'], current: 2 },
    events: ['stepselect'],
  },
  'progress-ring': {
    attrs: { label: 'Storage used' },
    props: { value: 68, max: 100 },
    events: [],
  },
  'line-chart': {
    attrs: { label: 'Price' },
    props: { points: [42.1, 43.8, 41.9, 44.6, 46.2, 45.1, 47.9, 49.3, 48.2, 50.6, 52.4, 51.1] },
    events: ['pointhover'],
  },
  'spark-line': {
    attrs: { label: 'Visitors this week' },
    props: { points: [120, 132, 101, 154, 190, 176, 210] },
    events: [],
  },
  'donut-chart': {
    attrs: { label: 'November spending' },
    props: { segments: [{ label: 'Rent', value: 1450, tone: 0 }, { label: 'Food', value: 520, tone: 1 }, { label: 'Transport', value: 160, tone: 2 }, { label: 'Fun', value: 240, tone: 3 }] },
    events: ['valuechange'],
  },
  'streak-grid': {
    attrs: { label: 'Reading streak', today: '2026-11-08' },
    props: {
      goal: 2,
      weeks: 8,
      log: Object.fromEntries(Array.from({ length: 56 }, (_, i) => {
        const day = new Date(Date.UTC(2026, 10, 8) - i * 86400000).toISOString().slice(0, 10);
        return [day, [0, 1, 2, 2, 1, 0, 2][i % 7]];
      }).filter(([, count]) => count)),
    },
    events: ['daytoggle'],
  },
  'kanban-column': {
    attrs: { heading: 'In progress' },
    props: { count: 2, limit: 3 },
    events: ['carddrop'],
    html: '<article id="card-notes" draggable="true">Write the release notes</article>\n<article id="card-theme" draggable="true">Review the theme picker</article>',
  },
  'chat-message': {
    attrs: { me: 'Sam Rivera' },
    props: {
      message: {
        id: 'm1',
        author: 'Maya Chen',
        text: 'Shipped the date picker. @sam can you check it on mobile? Notes: https://example.com/notes',
        time: Date.UTC(2026, 10, 8, 14, 30),
        reactions: { '🎉': ['Sam Rivera', 'Jo Park'], '👀': ['Jo Park'] },
        replyTo: null,
      },
    },
    events: ['reacttoggle', 'reply'],
  },
  'message-composer': {
    attrs: { placeholder: 'Message #design' },
    props: {},
    events: ['send'],
  },
  'action-button': {
    variants: { label: 'Every variant and size', html: '<action-button variant="primary">Primary</action-button><action-button variant="secondary">Secondary</action-button><action-button variant="outline">Outline</action-button><action-button variant="ghost">Ghost</action-button><action-button variant="destructive">Destructive</action-button><action-button variant="link">Link</action-button><action-button size="sm">Small</action-button><action-button size="lg">Large</action-button><action-button loading>Saving</action-button><action-button disabled>Disabled</action-button>' },
    attrs: { variant: 'primary' },
    events: ['click'],
    html: 'Save changes',
  },
  'text-field': {
    attrs: { label: 'Email', description: "We'll send the receipt here.", type: 'email', name: 'email', autocomplete: 'email', placeholder: 'you@example.com' },
    props: { required: true },
    events: ['valuechange'],
  },
  'check-box': {
    attrs: { label: 'Send me product updates', description: 'About once a month. Unsubscribe any time.', name: 'updates' },
    props: { checked: true },
    events: ['checkedchange'],
  },
  'radio-group': {
    attrs: { label: 'Delivery', name: 'delivery' },
    props: {
      value: 'standard',
      options: [
        { value: 'standard', label: 'Standard', description: '3–5 working days, free' },
        { value: 'express', label: 'Express', description: 'Next working day, $9' },
        { value: 'pickup', label: 'Collect in store', description: 'Ready in two hours' },
      ],
    },
    events: ['valuechange'],
  },
  'select-field': {
    attrs: { label: 'Country', name: 'country', placeholder: 'Choose a country', autocomplete: 'country' },
    props: {
      value: 'ca',
      options: [
        { value: 'ca', label: 'Canada' },
        { value: 'gb', label: 'United Kingdom' },
        { value: 'us', label: 'United States' },
        { value: 'ie', label: 'Ireland' },
      ],
    },
    events: ['valuechange'],
  },
  'status-badge': {
    variants: { label: 'Every variant', html: '<status-badge variant="neutral">Draft</status-badge><status-badge variant="primary">New</status-badge><status-badge variant="success">Paid</status-badge><status-badge variant="warning">Due soon</status-badge><status-badge variant="danger">Overdue</status-badge><status-badge variant="outline">Archived</status-badge><status-badge variant="success" dot>Online</status-badge>' },
    attrs: { variant: 'success' },
    props: { dot: true },
    html: 'Paid',
  },
  'user-avatar': {
    variants: { label: 'Sizes and statuses', html: '<user-avatar name="Grace Hopper" size="sm" status="busy"></user-avatar><user-avatar name="Alan Turing" size="md" status="away"></user-avatar><user-avatar name="Katherine Johnson" size="lg"></user-avatar><user-avatar name="Margaret Hamilton" size="xl" status="online"></user-avatar>' },
    attrs: { name: 'Ada Lovelace', size: 'lg', status: 'online' },
  },
  'content-card': {
    attrs: { heading: 'Sourdough for beginners', href: '#sourdough' },
    html: '<p>A starter, a loaf and a schedule that fits around work. Six steps, two days, mostly waiting.</p>\n<span slot="footer">12 min read</span>',
  },
  'alert-banner': {
    variants: { label: 'Every variant', html: '<alert-banner variant="info" heading="Heads up" style="inline-size: 100%">Maintenance on Sunday, 2–3 am.</alert-banner><alert-banner variant="success" heading="Payment received" style="inline-size: 100%">Thanks: your receipt is on its way.</alert-banner><alert-banner variant="danger" heading="Card declined" style="inline-size: 100%">Try another card, or contact your bank.</alert-banner>' },
    attrs: { variant: 'warning', heading: 'Your trial ends in 3 days' },
    props: { dismissible: true },
    events: ['close'],
    html: 'Add a payment method to keep your projects and their history.',
  },
  'toast-region': {
    attrs: { position: 'bottom-end' },
    events: ['toastclose'],
    trigger: { label: 'Save', event: 'toast', detail: { heading: 'Saved', message: 'Your changes are live.', variant: 'success' } },
  },
  'loading-spinner': {
    variants: { label: 'Sizes', html: '<loading-spinner size="sm" label="Loading"></loading-spinner><loading-spinner size="md" label="Loading"></loading-spinner><loading-spinner size="lg" label="Loading"></loading-spinner>' },
    attrs: { label: 'Loading your projects', size: 'md' },
    props: { inline: true },
  },
  'skeleton-block': {
    attrs: { shape: 'text', width: '20rem' },
    props: { lines: 3 },
  },
  'backdrop-pattern': {
    attrs: { pattern: 'aurora' },
    props: { animated: true },
    html: '<div class="demo-hero">\n  <h2>Ship components, not frameworks</h2>\n  <p>One file each, in any stack.</p>\n</div>',
  },
  'switcher-layout': {
    attrs: { threshold: '28rem', gap: '0.75rem' },
    html: '<div class="demo-box">Plan</div>\n<div class="demo-box">Build</div>\n<div class="demo-box">Ship</div>',
  },
  'reel-layout': {
    attrs: { item: '11rem', gap: '0.75rem', label: 'Upcoming events' },
    props: { controls: true },
    html: ['Bake sale', 'Choir night', 'Plant swap', 'Book club', 'Quiz night', 'Litter pick'].map((name) => `<div class="demo-box">${name}</div>`).join('\n'),
  },
  'breadcrumb-trail': {
    props: { items: [{ label: 'Home', href: '#home' }, { label: 'Recipes', href: '#recipes' }, { label: 'Breads', href: '#breads' }, { label: 'Sourdough' }] },
  },
  'page-nav': {
    props: { page: 6, pages: 20 },
    events: ['pagechange'],
  },
  'side-sheet': {
    attrs: { label: 'Filters', side: 'right' },
    props: { open: false },
    events: ['openchange'],
    html: '<p>Show only what you need.</p>\n<button slot="actions" type="button" data-close>Clear</button>\n<button slot="actions" type="button" data-close>Show 24 results</button>',
    opener: 'Filters',
  },
  'popover-panel': {
    attrs: { label: 'Share' },
    events: ['openchange'],
    html: '<p><strong>Share this recipe</strong></p>\n<p><a href="#copy">Copy link</a></p>\n<p><a href="#email">Email it</a></p>',
  },
  'command-palette': {
    props: {
      open: false,
      items: [
        { id: 'new', label: 'New project', group: 'Actions', hint: 'N' },
        { id: 'invite', label: 'Invite a teammate', group: 'Actions' },
        { id: 'theme', label: 'Switch theme', group: 'Actions' },
        { id: 'home', label: 'Dashboard', group: 'Pages', href: '#dashboard' },
        { id: 'billing', label: 'Billing', group: 'Pages', href: '#billing' },
        { id: 'settings', label: 'Settings', group: 'Pages', href: '#settings' },
      ],
    },
    events: ['select', 'openchange'],
    opener: 'Search (⌘K)',
  },
  'nav-bar': {
    attrs: { brand: 'Bakehouse', href: '#home' },
    props: { links: [{ label: 'Recipes', href: '#recipes', current: true }, { label: 'Classes', href: '#classes' }, { label: 'Shop', href: '#shop' }, { label: 'About', href: '#about' }] },
    html: '<a slot="actions" href="#signin">Sign in</a>',
  },
  'data-table': {
    attrs: { label: 'Invoices', currency: 'USD' },
    props: {
      selectable: true,
      columns: [
        { key: 'number', label: 'Invoice', sortable: true },
        { key: 'customer', label: 'Customer', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true, format: 'currency' },
      ],
      rows: [
        { id: 1, number: 'INV-1042', customer: 'Northwind', status: 'Paid', amount: 1250 },
        { id: 2, number: 'INV-1043', customer: 'Acme Bakery', status: 'Due', amount: 310.5 },
        { id: 3, number: 'INV-1044', customer: 'Globex', status: 'Overdue', amount: 4800 },
        { id: 4, number: 'INV-1045', customer: 'Initech', status: 'Paid', amount: 99 },
        { id: 5, number: 'INV-1046', customer: 'Umbrella', status: 'Due', amount: 2075 },
      ],
    },
    events: ['selectedchange', 'sortchange'],
  },
  'progress-bar': {
    attrs: { label: 'Uploading photos' },
    props: { value: 64 },
  },
  'empty-state': {
    attrs: { heading: 'No invoices yet' },
    html: 'Invoices you send show up here, with who has paid.\n<button slot="actions" type="button">Create an invoice</button>',
  },
  'stat-card': {
    attrs: { label: 'Monthly revenue', value: '$48,210', period: 'vs last month' },
    props: { change: 12.4 },
  },
  'bar-chart': {
    attrs: { label: 'Visits by source', unit: '%' },
    props: { sorted: true, items: [{ label: 'Search', value: 42 }, { label: 'Direct', value: 23 }, { label: 'Social', value: 18 }, { label: 'Email', value: 11 }, { label: 'Referral', value: 6 }] },
  },
  'range-slider': {
    attrs: { label: 'Budget', unit: '', name: 'budget' },
    props: { value: 400, min: 0, max: 1000, step: 50 },
    events: ['valuechange'],
  },
  'file-drop': {
    attrs: { label: 'Attachments', name: 'files', accept: '.pdf,image/*' },
    props: { maxSize: 10 },
    events: ['fileschange'],
  },
  'code-input': {
    attrs: { label: 'Enter the 6-digit code we sent you', name: 'code' },
    events: ['valuechange', 'complete'],
  },
  'date-field': {
    attrs: { label: 'Delivery date', description: 'We deliver Monday to Friday.', name: 'delivery', min: '2026-01-01' },
    props: { value: '2026-12-04' },
    events: ['valuechange'],
  },
  'hero-section': {
    attrs: { eyebrow: 'New: spring classes', heading: 'Bake bread you are proud of', align: 'start' },
    html: 'Small classes, real ovens, and a starter to take home. Weekends in Portland and online.\n<button slot="actions" type="button">Book a class</button>\n<a slot="actions" href="#menu">See the schedule</a>',
  },
  'feature-grid': {
    attrs: { heading: 'Everything for your bakery' },
    props: { items: [{ icon: '🥖', title: 'Recipes that scale', text: 'Change the batch size and every amount follows.' }, { icon: '⏱', title: 'Timers per step', text: 'Proofs and bakes run side by side, with alerts.' }, { icon: '🧾', title: 'Costs per loaf', text: 'Ingredient prices turn into a price per item.' }] },
  },
  'testimonial-card': {
    attrs: { name: 'Priya Raman', byline: 'Owner, Rise & Crumb' },
    html: 'We cut our morning prep by an hour. The timers alone paid for it in a week.',
  },
  'faq-list': {
    attrs: { heading: 'Questions' },
    props: { single: true, items: [{ question: 'Do I need my own starter?', answer: 'No. Every class gives you a starter to take home, with a feeding schedule.' }, { question: 'Can I cancel?', answer: 'Yes, up to 48 hours before the class, for a full refund.' }, { question: 'Are classes accessible?', answer: 'The kitchen is step-free, and benches can be lowered.' }] },
  },
  'site-footer': {
    attrs: { brand: 'Bakehouse', legal: '© 2026 Bakehouse. All rights reserved.' },
    props: { columns: [{ heading: 'Learn', links: [{ label: 'Classes', href: '#classes' }, { label: 'Recipes', href: '#recipes' }] }, { heading: 'Company', links: [{ label: 'About', href: '#about' }, { label: 'Careers', href: '#careers' }] }, { heading: 'Help', links: [{ label: 'Contact', href: '#contact' }, { label: 'Refunds', href: '#refunds' }] }] },
    html: 'Bread classes and recipes since 2019.',
  },
  'newsletter-signup': {
    attrs: { heading: 'Get the weekly loaf', text: 'One recipe and one technique, every Friday.', note: 'No spam. Unsubscribe any time.' },
    events: ['subscribe'],
  },
  'logo-cloud': {
    attrs: { heading: 'Trusted by bakeries in 40 cities' },
    props: { items: [{ name: 'Northwind' }, { name: 'Rise & Crumb' }, { name: 'Globex' }, { name: 'Initech' }, { name: 'Umbrella' }] },
  },
};
