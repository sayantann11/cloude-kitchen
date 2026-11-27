import type { Menu, MenuItem, Settings } from './types';

/**
 * Starting menu: The Night Kitchen menu card (pure veg). The owner edits all of this
 * from Admin → Menu (prices, stock, sold out, new dishes); nothing here is hard-wired.
 */
type Row = [name: string, price: number, desc?: string];

const SECTIONS: [category: string, rows: Row[]][] = [
  ['Combos & Meals', [
    ['Budget Dinner', 149, 'Dal Fry + Steam Rice'],
    ['Indian Meal', 169, 'Mix Veg + 3 Tawa Rotis'],
    ['Paneer Meal', 199, 'Paneer Masala + 3 Tawa Rotis'],
    ['Biryani Combo', 159, 'Veg Biryani + Boondi Raita'],
    ['Premium Biryani Combo', 189, 'Paneer Biryani + Boondi Raita'],
    ['Chinese Combo', 219, 'Veg Fried Rice + Veg Manchurian Dry'],
    ['Noodles Combo', 219, 'Veg Hakka Noodles + Veg Manchurian Dry'],
    ['Snack Combo', 159, 'French Fries + Veg Sandwich'],
    ['Roll Combo', 189, 'Paneer Roll + French Fries'],
  ]],
  ['Indian Main Course', [
    ['Mix Veg', 155, 'Seasonal vegetables in onion-tomato masala'],
    ['Paneer Masala', 185, 'Paneer cubes in spiced onion-tomato gravy'],
    ['Paneer Kadhai', 205, 'Paneer with capsicum, onion and kadhai masala'],
    ['Matar Paneer', 185, 'Paneer and green peas curry'],
    ['Paneer Lababdar', 215, 'Paneer in rich, creamy tomato gravy'],
    ['Paneer Makhani Wala', 205, 'Paneer in buttery makhani gravy'],
    ['Malai Kofta', 215, 'Paneer-potato dumplings in creamy cashew gravy'],
    ['Shahi Paneer', 215, 'Paneer in mild, rich cashew-cream gravy'],
    ['Methi Mutter', 195, 'Fenugreek leaves and peas in creamy gravy'],
    ['Aloo Dum Banarasi', 165, 'Baby potatoes in Banarasi-style dum gravy'],
    ['Kaju Curry', 225, 'Roasted cashews in rich gravy'],
    ['Mushroom Masala', 195, 'Mushrooms in spiced onion-tomato masala'],
    ['Mushroom Kadhai', 205, 'Mushrooms with capsicum and kadhai masala'],
    ['Paneer Do Pyaza', 205, 'Paneer with double onion'],
    ['Palak Paneer', 195, 'Paneer in smooth spinach gravy'],
    ['Corn Masala', 175, 'Sweet corn in spiced masala gravy'],
    ['Aloo Gobi Masala', 165, 'Potato and cauliflower dry masala'],
    ['Chana Masala', 155, 'Chickpeas in tangy, spiced gravy'],
    ['Mushroom Do Pyaza', 205, 'Mushrooms with double onion'],
    ['Nizami Deewani Handi', 225, 'Mixed vegetables in rich handi gravy'],
  ]],
  ['Rice & Biryani', [
    ['Steam Rice', 70, 'Plain steamed basmati rice'],
    ['Jeera Rice', 100, 'Basmati rice tempered with cumin'],
    ['Green Peas Pulao', 120, 'Basmati rice with green peas'],
    ['Veg Biryani', 130, 'Dum-style biryani with vegetables'],
    ['Paneer Biryani', 160, 'Dum-style biryani with paneer'],
    ['Aloo Paneer Biryani', 150, 'Biryani with potato and paneer'],
    ['Paneer Fried Rice', 150, 'Wok-tossed rice with paneer'],
    ['Veg Fried Rice', 120, 'Wok-tossed rice with vegetables'],
    ['Chilli Garlic Rice', 140, 'Fried rice with chilli and garlic'],
    ['Paneer Chilli Garlic Rice', 170, 'Chilli garlic rice with paneer'],
    ['Triple Schezwan Fried Rice', 180, 'Schezwan rice with noodles and gravy'],
  ]],
  ['Chinese Noodles', [
    ['Veg Hakka Noodles', 120, 'Classic stir-fried noodles with vegetables'],
    ['Paneer Hakka Noodles', 150, 'Hakka noodles with paneer'],
    ['Veg Chilli Garlic Noodles', 140, 'Noodles tossed with chilli and garlic'],
    ['Paneer Chilli Garlic Noodles', 170, 'Chilli garlic noodles with paneer'],
    ['Veg Mix Noodles', 150, 'Noodles with mixed vegetables and sauces'],
    ['Schezwan Noodles', 140, 'Spicy schezwan noodles'],
    ['Mix Schezwan Noodles', 160, 'Schezwan noodles with mixed vegetables'],
    ['Paneer Schezwan Noodles', 170, 'Schezwan noodles with paneer'],
  ]],
  ['Chinese Starters', [
    ['Veg Manchurian Dry', 120, 'Veg balls tossed in Manchurian sauce'],
    ['Veg Manchurian Gravy', 140, 'Veg balls in Manchurian gravy'],
    ['Paneer Manchurian Dry', 180, 'Paneer tossed in Manchurian sauce'],
    ['Paneer Manchurian Gravy', 200, 'Paneer in Manchurian gravy'],
    ['Paneer Chilli Dry', 170, 'Crispy paneer with chilli, onion and capsicum'],
    ['Paneer Chilli Gravy', 190, 'Chilli paneer in gravy'],
    ['Dragon Paneer', 200, 'Crispy paneer in fiery dragon sauce'],
    ['Schezwan Paneer', 180, 'Paneer tossed in schezwan sauce'],
    ['Honey Chilli Potato', 140, 'Crispy potato fingers in honey chilli sauce'],
    ['Chana Chilli', 150, 'Crispy chickpeas tossed Chinese style'],
    ['Corn Chilli', 150, 'Crispy corn with chilli and spring onion'],
    ['Mushroom Chilli Dry', 170, 'Crispy mushrooms with chilli'],
    ['Mushroom Chilli Gravy', 190, 'Chilli mushrooms in gravy'],
    ['Crispy Chilli Baby Corn', 170, 'Crispy baby corn tossed with chilli'],
    ['Paneer Pakoda', 170, 'Gram-flour fried paneer fritters'],
  ]],
  ['Snacks & Starters', [
    ['French Fries', 99, 'Salted crispy fries'],
    ['Peri Peri Fries', 119, 'Fries with peri peri seasoning'],
    ['Cheese Balls', 149, 'Crispy fried cheese balls'],
    ['American Corn Salt & Pepper', 139, 'Sweet corn tossed with salt and pepper'],
    ['Butter Roasted Corn', 99, 'Sweet corn roasted in butter'],
    ['Veg Crispy', 150, 'Crispy fried vegetables, Chinese style'],
    ['Paneer 65', 180, 'Spicy fried paneer, South Indian style'],
    ['Baby Corn Chilli', 160, 'Baby corn tossed in chilli sauce'],
  ]],
  ['Momos', [
    ['Veg Fried Momos', 99, 'Fried vegetable momos with chutney'],
    ['Crispy Momos', 119, 'Extra-crispy fried momos'],
    ['Fried Chilli Momos', 129, 'Fried momos tossed in chilli sauce'],
  ]],
  ['Rolls & Wraps', [
    ['Veg Roll', 79, 'Paratha roll with spiced vegetables'],
    ['Paneer Roll', 109, 'Paratha roll with paneer'],
    ['Veg Wrap', 89, 'Soft wrap with vegetables and sauces'],
    ['Paneer Wrap', 119, 'Soft wrap with paneer'],
    ['Paneer Schezwan Wrap', 129, 'Wrap with schezwan paneer'],
    ['Veg Mix Wrap', 99, 'Wrap with mixed vegetables'],
    ['Paneer Cheese Roll', 139, 'Paneer roll with cheese'],
    ['Corn Cheese Roll', 129, 'Sweet corn and cheese roll'],
    ['Spring Roll', 119, 'Crispy vegetable spring rolls'],
  ]],
  ['Sandwiches', [
    ['Veg Sandwich', 89, 'Grilled vegetable sandwich'],
    ['Paneer Sandwich', 119, 'Grilled paneer sandwich'],
    ['Corn Cheese Sandwich', 129, 'Grilled corn and cheese sandwich'],
  ]],
  ['Soups', [
    ['Veg Manchow Soup', 99, 'Spicy soup with crispy noodles'],
    ['Veg Hot & Sour Soup', 99, 'Tangy, peppery vegetable soup'],
    ['Lemon Coriander Soup', 89, 'Light soup with lemon and coriander'],
    ['Sweet Corn Soup', 99, 'Creamy sweet corn soup'],
    ['Cream of Tomato Soup', 109, 'Smooth tomato soup with cream'],
    ['Cream of Mushroom Soup', 119, 'Creamy mushroom soup'],
  ]],
  ['Dal', [
    ['Dal Fry', 100, 'Yellow dal with onion-tomato tadka'],
    ['Dal Tadka', 120, 'Yellow dal with ghee, garlic and red chilli tadka'],
    ['Dal Makhani', 160, 'Slow-cooked black dal with butter and cream'],
  ]],
  ['Roti & Paratha', [
    ['Tawa Roti (each)', 12, 'Whole wheat roti'],
    ['Butter Roti (each)', 15, 'Tawa roti with butter'],
    ['Lachha Paratha', 40, 'Layered flaky paratha'],
    ['Aloo Paratha', 60, 'Paratha stuffed with spiced potato'],
  ]],
  ['Salad & Raita', [
    ['Green Salad', 50, 'Onion, cucumber, tomato and lemon'],
    ['Boondi Raita', 60, 'Curd with crispy boondi'],
    ['Pineapple Raita', 80, 'Curd with pineapple'],
    ['Mix Raita', 70, 'Curd with onion, cucumber and tomato'],
  ]],
];

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SEED_MENU: Menu = {
  updatedAt: 0,
  categories: SECTIONS.map(([c]) => c),
  items: SECTIONS.flatMap(([category, rows]) => rows.map(([name, price, desc = '']): MenuItem => ({
    id: slug(name), category, name, desc, price, veg: true, available: true,
  }))),
};

// Open all day while the client tests. Set the real hours in Admin → Settings (saved settings replace these).
const allDay = { open: '00:00', close: '00:00' };

export const SEED_SETTINGS: Settings = {
  kitchenName: 'The Night Kitchen',
  tagline: 'Pure veg Indian & Chinese, for your late-night cravings',
  phone: '9000000000',
  whatsapp: '919000000000',
  address: 'Sambalpur, Odisha',
  location: { lat: 21.4712, lng: 83.9795 },
  hours: [allDay, allDay, allDay, allDay, allDay, allDay, allDay],
  paused: false,
  pauseMessage: 'Kitchen is very busy. Please try again in 20 minutes.',
  minOrder: 99,
  deliveryFee: 25,
  freeDeliveryAbove: 399,
  outerZoneKm: 8,
  outerZoneFee: 40,
  maxDeliveryKm: 18,
  promiseMin: 50,
  outerPromiseMin: 75,
  prepMin: 20,
  batchWindowMin: 40,
  maxPerTrip: 3,
  nearKm: 3.2,
  upiId: '',
  upiName: 'The Night Kitchen',
  riders: [
    { id: 'r1', name: 'Rider 1', phone: '9000000001' },
  ],
  updatedAt: 0,
};
