/* Aaina Beauty Studio - demo data
   Services, prices, stylists and combos live here, so the price menu and the
   booking page always show the same numbers. Change a price here, it changes everywhere. */

const serviceCategories = [
  { id: 'hair', name: 'Hair' },
  { id: 'makeup', name: 'Makeup' },
  { id: 'skin', name: 'Skin & Waxing' },
  { id: 'nails', name: 'Nails' },
  { id: 'mehendi', name: 'Mehendi' }
];

/* mins = duration, from = price depends on length/design, offer = % off this month,
   tag = small badge, bridal = not bookable here, links to the bridal page */
const serviceList = [
  // Hair
  { id: 'womens-haircut', cat: 'hair', name: "Women's Haircut", desc: 'Wash, cut and blow-dry, shaped to your face and hair type.', mins: 45, price: 399, tag: 'Popular',
    includes: ['Hair wash and conditioning', 'Style consultation', 'Blow-dry finish'] },
  { id: 'butterfly-cut', cat: 'hair', name: 'Butterfly Cut', desc: 'Layered, face-framing cut with a bouncy blow-dry.', mins: 60, price: 899, from: true, tag: 'Trending',
    includes: ['Consultation with your reference photo', 'Layered cut', 'Blow-dry finish'] },
  { id: 'curtain-bangs', cat: 'hair', name: 'Curtain Bangs', desc: 'Soft bangs that part in the middle and frame your face.', mins: 20, price: 299, from: true, tag: 'Trending',
    includes: ['Bangs consultation', 'Cut and shaping', 'Quick styling tips'] },
  { id: 'waterfall-braid', cat: 'hair', name: 'Waterfall Braid', desc: 'A braid that cascades into loose curls, great for parties.', mins: 45, price: 599, from: true,
    includes: ['Hair prep and curling', 'Waterfall braid', 'Setting spray finish'] },
  { id: 'braided-crown', cat: 'hair', name: 'Braided Crown', desc: 'A braided updo with soft strands left around the face.', mins: 45, price: 799, from: true,
    includes: ['Hair prep', 'Braided crown updo', 'Pins and setting spray'] },
  { id: 'blowout-curls', cat: 'hair', name: 'Blowout and Curls', desc: 'A smooth blowout or soft curls for a night out.', mins: 40, price: 499, from: true,
    includes: ['Wash and blow-dry', 'Straight or curled finish', 'Heat protection'] },
  { id: 'hair-spa', cat: 'hair', name: 'Hair Spa', desc: 'Deep conditioning with a relaxing scalp massage.', mins: 60, price: 799, from: true, offer: 20,
    includes: ['Scalp massage', 'Deep conditioning mask', 'Steam and blow-dry'], note: 'Festive offer: 20% off this month.' },
  { id: 'global-colour', cat: 'hair', name: 'Global Hair Colour', desc: 'One shade all over, with ammonia-free options.', mins: 120, price: 2499, from: true,
    includes: ['Shade consultation', 'Colour application', 'Wash, mask and blow-dry'], note: 'Price depends on hair length. We do a free patch test first.' },
  { id: 'highlights', cat: 'hair', name: 'Highlights and Balayage', desc: 'Hand-painted lightness for a soft, sun-kissed look.', mins: 180, price: 3999, from: true,
    includes: ['Shade consultation', 'Hand-painted lightener', 'Toner, mask and blow-dry'], note: 'Price depends on hair length and the shade you pick.' },
  { id: 'smoothening', cat: 'hair', name: 'Keratin Smoothening', desc: 'Frizz-free, shiny hair that lasts up to four months.', mins: 180, price: 3499, from: true,
    includes: ['Hair analysis', 'Keratin treatment', 'Heat seal and blow-dry'], note: 'Avoid washing your hair for 48 hours after the treatment.' },

  // Makeup
  { id: 'party-makeup', cat: 'makeup', name: 'Party Makeup', desc: 'Clean, long-wear makeup for parties and events.', mins: 60, price: 1499, tag: 'Popular',
    includes: ['Skin prep', 'Full-face makeup', 'Setting spray'] },
  { id: 'soft-glam', cat: 'makeup', name: 'Soft Glam', desc: 'A natural glow, soft eyes and a glossy lip.', mins: 75, price: 1999, tag: 'Trending',
    includes: ['Skin prep and glow base', 'Soft eye look', 'Lashes on request'] },
  { id: 'smokey-bronze', cat: 'makeup', name: 'Smokey Bronze', desc: 'Warm smoky eyes with a bronzed, sculpted face.', mins: 75, price: 2499,
    includes: ['Skin prep', 'Smoky eyes and contour', 'Lashes included'] },
  { id: 'engagement-makeup', cat: 'makeup', name: 'Engagement Makeup', desc: 'Camera-ready makeup built to last through the function.', mins: 90, price: 3999,
    includes: ['HD base', 'Eyes, lashes and contour', 'Touch-up kit to carry'], note: 'Getting married? See our bridal packages.' },
  { id: 'saree-draping', cat: 'makeup', name: 'Saree Draping', desc: 'Neat pleats and a secure drape that lasts all day.', mins: 20, price: 499,
    includes: ['Pleating and pinning', 'Pallu styling', 'Safety pins and fixing'] },

  // Skin & Waxing
  { id: 'face-threading', cat: 'skin', name: 'Face Threading', desc: 'Eyebrows, upper lip and forehead.', mins: 15, price: 149,
    includes: ['Eyebrows', 'Upper lip', 'Forehead'] },
  { id: 'underarms-wax', cat: 'skin', name: 'Underarms Wax', desc: 'Fresh honey wax with single-use strips.', mins: 10, price: 149,
    includes: ['Honey wax', 'Single-use strips', 'Soothing gel'] },
  { id: 'full-arms-wax', cat: 'skin', name: 'Full Arms Wax', desc: 'Smooth arms with fresh wax and a soothing finish.', mins: 25, price: 249,
    includes: ['Honey wax', 'Single-use strips', 'Soothing gel'] },
  { id: 'full-legs-wax', cat: 'skin', name: 'Full Legs Wax', desc: 'Smooth legs with fresh wax and a soothing finish.', mins: 30, price: 349, tag: 'Popular',
    includes: ['Honey wax', 'Single-use strips', 'Soothing gel'] },
  { id: 'full-body-wax', cat: 'skin', name: 'Full Body Wax', desc: 'Arms, legs, underarms and back, done in one visit.', mins: 75, price: 1299,
    includes: ['Arms, legs and underarms', 'Back wax', 'Soothing gel'], note: 'Rica wax is available for sensitive skin.' },
  { id: 'cleanup', cat: 'skin', name: 'Clean-up', desc: 'Cleansing, scrub and a massage for a fresh face.', mins: 40, price: 599, tag: 'Popular',
    includes: ['Cleansing and scrub', 'Face massage', 'Mask and moisturiser'] },
  { id: 'glow-facial', cat: 'skin', name: 'Glow Facial', desc: 'A brightening facial with a vitamin C mask.', mins: 60, price: 999,
    includes: ['Deep cleansing', 'Massage and vitamin C mask', 'Sunscreen finish'], note: 'Tell us about any skin allergies when you book.' },
  { id: 'de-tan', cat: 'skin', name: 'De-tan Treatment', desc: 'Lifts tan from the face and neck.', mins: 45, price: 799,
    includes: ['Cleansing', 'De-tan pack', 'Soothing mask'] },

  // Nails
  { id: 'manicure', cat: 'nails', name: 'Manicure', desc: 'Shaping, cuticle care, scrub and a hand massage.', mins: 40, price: 499,
    includes: ['Nail shaping', 'Cuticle care and scrub', 'Hand massage and polish'] },
  { id: 'pedicure', cat: 'nails', name: 'Pedicure', desc: 'A foot soak, scrub, shaping and a calf massage.', mins: 50, price: 699,
    includes: ['Foot soak and scrub', 'Nail shaping and cuticles', 'Massage and polish'] },
  { id: 'gel-polish', cat: 'nails', name: 'Gel Polish', desc: 'Chip-free colour that lasts up to three weeks.', mins: 45, price: 799, tag: 'Popular',
    includes: ['Nail prep', 'Gel colour', 'UV cure and top coat'] },
  { id: 'nail-extensions', cat: 'nails', name: 'Nail Extensions', desc: 'Gel extensions in the length and shape you choose.', mins: 90, price: 1499, from: true,
    includes: ['Length and shape consultation', 'Gel extensions', 'Gel colour finish'], note: 'Nail art is charged separately.' },
  { id: 'nail-art', cat: 'nails', name: 'Nail Art', desc: 'Hand-painted designs, priced per hand.', mins: 30, price: 499, from: true,
    includes: ['Design consultation', 'Hand-painted art', 'Top coat'], note: 'Bring a reference photo for the best result.' },

  // Mehendi
  { id: 'quick-mehendi', cat: 'mehendi', name: 'Quick Mehendi', desc: 'A small, neat design on one hand.', mins: 20, price: 399,
    includes: ['Small motif design', 'Natural henna paste', 'Aftercare tips'] },
  { id: 'party-mehendi', cat: 'mehendi', name: 'Party Mehendi', desc: 'One hand with a full floral or Arabic design.', mins: 45, price: 799, tag: 'Popular',
    includes: ['Full-hand design', 'Natural henna paste', 'Aftercare tips'] },
  { id: 'festive-mehendi', cat: 'mehendi', name: 'Festive Both Hands', desc: 'Both hands, ready for Karwa Chauth, Eid or Teej.', mins: 90, price: 1299, tag: 'Festive',
    includes: ['Both-hand design', 'Natural henna paste', 'Aftercare tips'] },
  { id: 'bridal-mehendi', cat: 'mehendi', name: 'Bridal Mehendi', desc: 'Full hands to elbow and feet, 5 to 6 hours.', mins: 330, price: 4999, bridal: true,
    includes: ['Hands to elbow and feet', 'Natural henna paste', 'Part of our bridal packages'] }
];

/* artists, used by the booking page */
const stylistList = [
  { id: 'riya', name: 'Riya Malhotra', role: 'Creative Director, Hair', cats: ['hair'] },
  { id: 'naina', name: 'Naina Verma', role: 'Makeup Artist', cats: ['makeup'] },
  { id: 'simran', name: 'Simran Kaur', role: 'Skin and Nails', cats: ['skin', 'nails'] },
  { id: 'pooja', name: 'Pooja Saini', role: 'Mehendi and Bridal', cats: ['mehendi'] }
];

/* combos: percent = demo discount on the listed services */
const comboList = [
  { id: 'party-ready', name: 'Party Ready', blurb: 'Hair, face and nails done for the night.', ids: ['blowout-curls', 'party-makeup', 'gel-polish'], percent: 15 },
  { id: 'pamper-day', name: 'Pamper Day', blurb: 'A fresh cut, a facial and a de-tan in one visit.', ids: ['womens-haircut', 'glow-facial', 'de-tan'], percent: 12 },
  { id: 'glow-up', name: 'Quick Glow Up', blurb: 'The essentials before an event this weekend.', ids: ['face-threading', 'cleanup', 'underarms-wax'], percent: 10 },
  { id: 'festive-hands', name: 'Festive Hands', blurb: 'Hands and feet ready for the festive season.', ids: ['manicure', 'pedicure', 'party-mehendi'], percent: 15 }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { serviceCategories, serviceList, stylistList, comboList };
}
