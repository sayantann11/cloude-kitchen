import type { Menu, Settings } from './types';

/** Starting menu. The owner edits all of this from Kitchen → Menu; nothing here is hard-wired. */
export const SEED_MENU: Menu = {
  updatedAt: 0,
  categories: ['Odia specials', 'Thali', 'Snacks', 'Sweets', 'Drinks'],
  items: [
    { id: 'dalma', category: 'Odia specials', name: 'Dalma Bhata', nameOr: 'ଡାଲମା ଭାତ', desc: 'Toor dal with raw papaya, pumpkin and ghee tadka, with steamed rice', price: 130, veg: true, tag: 'Bestseller', available: true },
    { id: 'besara', category: 'Odia specials', name: 'Machha Besara', nameOr: 'ମାଛ ବେସର', desc: 'Rohu in mustard gravy, Odia home style, with rice', price: 220, veg: false, available: true },
    { id: 'kassa', category: 'Odia specials', name: 'Chicken Kassa', nameOr: 'ଚିକେନ କଷା', desc: 'Slow-cooked dry chicken with onion and whole spices', price: 240, veg: false, tag: 'Spicy', available: true },
    { id: 'mudhi', category: 'Odia specials', name: 'Mudhi Mansa', nameOr: 'ମୁଢି ମାଂସ', desc: 'Mutton curry served with fresh puffed rice', price: 260, veg: false, available: true },
    { id: 'santula', category: 'Odia specials', name: 'Santula', nameOr: 'ସନ୍ତୁଳା', desc: 'Light mixed-vegetable stew with panch phutana', price: 110, veg: true, available: true },
    { id: 'chhenatarkari', category: 'Odia specials', name: 'Chhena Tarkari', nameOr: 'ଛେନା ତରକାରୀ', desc: 'Cottage cheese and potato curry', price: 160, veg: true, available: true },
    { id: 'vthali', category: 'Thali', name: 'Odia Veg Thali', nameOr: 'ଓଡ଼ିଆ ଭେଜ ଥାଳି', desc: 'Rice, dal, santula, saga, bhaja, khata and papad', price: 180, veg: true, tag: 'Most ordered', available: true },
    { id: 'fthali', category: 'Thali', name: 'Fish Thali', nameOr: 'ମାଛ ଥାଳି', desc: 'Veg thali with machha besara', price: 270, veg: false, available: true },
    { id: 'cthali', category: 'Thali', name: 'Chicken Thali', nameOr: 'ଚିକେନ ଥାଳି', desc: 'Veg thali with chicken kassa', price: 260, veg: false, available: true },
    { id: 'gupchup', category: 'Snacks', name: 'Gupchup (6 pcs)', nameOr: 'ଗୁପଚୁପ', desc: 'Ghuguni-potato filling with tangy tamarind water', price: 40, veg: true, available: true },
    { id: 'dahibara', category: 'Snacks', name: 'Dahibara Aloodum', nameOr: 'ଦହିବରା ଆଳୁଦମ', desc: 'Soft dahibara in curd with spicy aloo dum', price: 60, veg: true, tag: 'Bestseller', available: true },
    { id: 'eggroll', category: 'Snacks', name: 'Egg Roll', nameOr: 'ଏଗ ରୋଲ', desc: 'Paratha roll with double egg, onion and sauce', price: 70, veg: false, available: true },
    { id: 'pakoda', category: 'Snacks', name: 'Chicken Pakoda', nameOr: 'ଚିକେନ ପକୋଡ଼ା', desc: 'Crispy boneless chicken fritters', price: 150, veg: false, available: true },
    { id: 'chhenapoda', category: 'Sweets', name: 'Chhena Poda (2 slices)', nameOr: 'ଛେନା ପୋଡ଼', desc: 'Baked caramelised cottage cheese', price: 60, veg: true, tag: 'Must try', available: true },
    { id: 'rasabali', category: 'Sweets', name: 'Rasabali (2 pcs)', nameOr: 'ରସାବଳୀ', desc: 'Fried chhena discs in thickened sweet milk', price: 50, veg: true, available: true },
    { id: 'kakara', category: 'Sweets', name: 'Kakara Pitha (2 pcs)', nameOr: 'କାକରା ପିଠା', desc: 'Semolina pitha with coconut-jaggery filling', price: 45, veg: true, available: true },
    { id: 'lassi', category: 'Drinks', name: 'Sweet Lassi (300 ml)', nameOr: 'ଲସି', desc: 'Thick curd lassi', price: 50, veg: true, available: true },
    { id: 'soda', category: 'Drinks', name: 'Masala Lemon Soda', nameOr: 'ଲେମ୍ବୁ ସୋଡା', desc: '300 ml', price: 30, veg: true, available: true },
  ],
};

const evening = { open: '18:00', close: '23:30' };

export const SEED_SETTINGS: Settings = {
  kitchenName: 'Mahanadi Kitchen',
  tagline: 'Odia home food, delivered across Sambalpur',
  phone: '9000000000',
  whatsapp: '919000000000',
  address: 'Modipara, Sambalpur, Odisha',
  location: { lat: 21.4712, lng: 83.9795 },
  hours: [evening, evening, evening, evening, evening, evening, evening],
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
  upiName: 'Mahanadi Kitchen',
  riders: [
    { id: 'r1', name: 'Rider 1', phone: '9000000001' },
  ],
  updatedAt: 0,
};
