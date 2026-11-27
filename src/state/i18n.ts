import { lang } from './app';

/** Customer-facing strings. Odia should be reviewed by a native speaker before launch. */
const OR: Record<string, string> = {
  'Search dishes': 'ଖାଦ୍ୟ ଖୋଜନ୍ତୁ',
  'Veg only': 'କେବଳ ଶାକାହାରୀ',
  'Add': 'ଯୋଡ଼ନ୍ତୁ',
  'Sold out': 'ସରିଗଲା',
  'View cart': 'କାର୍ଟ ଦେଖନ୍ତୁ',
  'items': 'ଟି ଆଇଟମ',
  'My orders': 'ମୋ ଅର୍ଡର',
  'Your order': 'ଆପଣଙ୍କ ଅର୍ଡର',
  'Delivery location': 'ଡେଲିଭରି ସ୍ଥାନ',
  'Use my current location': 'ମୋର ବର୍ତ୍ତମାନ ସ୍ଥାନ ବ୍ୟବହାର କରନ୍ତୁ',
  'House no. and landmark': 'ଘର ନମ୍ବର ଏବଂ ଚିହ୍ନ',
  'Name': 'ନାମ',
  'Mobile number': 'ମୋବାଇଲ ନମ୍ବର',
  'Payment': 'ପେମେଣ୍ଟ',
  'Cash on delivery': 'ଡେଲିଭରି ସମୟରେ ନଗଦ',
  'UPI on delivery': 'ଡେଲିଭରି ସମୟରେ UPI',
  'Pay now by UPI': 'ବର୍ତ୍ତମାନ UPI ରେ ଦିଅନ୍ତୁ',
  'Place order': 'ଅର୍ଡର କରନ୍ତୁ',
  'Item total': 'ଆଇଟମ ମୋଟ',
  'Delivery fee': 'ଡେଲିଭରି ଶୁଳ୍କ',
  'To pay': 'ଦେୟ',
  'Order placed': 'ଅର୍ଡର ହେଲା',
  'Accepted': 'ଗ୍ରହଣ ହେଲା',
  'Being cooked': 'ରାନ୍ଧା ଚାଲିଛି',
  'Out for delivery': 'ଡେଲିଭରି ପାଇଁ ବାହାରିଛି',
  'Delivered': 'ପହଞ୍ଚିଗଲା',
  'Cancelled': 'ବାତିଲ',
  'Arriving by': 'ପହଞ୍ଚିବ',
  'Call kitchen': 'ରୋଷେଇଘରକୁ କଲ କରନ୍ତୁ',
  'Order again': 'ପୁଣି ଅର୍ଡର କରନ୍ତୁ',
  'Cooking note (optional)': 'ରାନ୍ଧିବା ନିର୍ଦ୍ଦେଶ (ଇଚ୍ଛାଧୀନ)',
  'Back to menu': 'ମେନୁକୁ ଫେରନ୍ତୁ',
  'Your cart is empty': 'ଆପଣଙ୍କ କାର୍ଟ ଖାଲି ଅଛି',
  'Browse menu': 'ମେନୁ ଦେଖନ୍ତୁ',
  'Free delivery': 'ମାଗଣା ଡେଲିଭରି',
};

export function t(s: string): string {
  return lang.value === 'or' ? OR[s] ?? s : s;
}
