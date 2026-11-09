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
};
