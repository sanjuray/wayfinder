/**
 * The 120-quote bank. Locked content per the spec.
 *
 * Five categories:
 * - pop-culture (30): paraphrased winks at film/TV/anime/games — no verbatim quotes
 * - taunting (25): sharp, slightly mean, includes 3 dynamic quotes that fire only when conditions match
 * - empathy (20): warm, no judgment, trip offered as answer not obligation
 * - encouraging (20): action-oriented, direct, brighter than empathy
 * - ambient (25): observational, atmospheric, the poetry
 *
 * Dynamic quotes have placeholders in {curlies} that the quote service fills
 * at render time using the user's current data via quote-conditions.ts.
 */

export type QuoteCategory =
  | 'pop-culture'
  | 'taunting'
  | 'empathy'
  | 'encouraging'
  | 'ambient';

export type DynamicConditionId =
  | 'lazy-ratio'
  | 'old-pin-month'
  | 'old-pin-named';

export interface StaticQuote {
  text: string;
  category: QuoteCategory;
  type: 'static';
}

export interface DynamicQuote {
  text: string;
  category: QuoteCategory;
  type: 'dynamic';
  conditionId: DynamicConditionId;
}

export type Quote = StaticQuote | DynamicQuote;

export const QUOTE_BANK: Quote[] = [
  // ===== POP CULTURE (30) =====
  { text: "ted mosby's kids wouldn't exist if he stayed home.", category: 'pop-culture', type: 'static' },
  { text: 'jiraiya-sensei went on trips for inspiration. just saying.', category: 'pop-culture', type: 'static' },
  { text: "frodo only had nine stops. you've planned fourteen.", category: 'pop-culture', type: 'static' },
  { text: "dora wouldn't shut up about exploring. and look at her now.", category: 'pop-culture', type: 'static' },
  { text: 'sherlock walked everywhere. holmes-pace. try it.', category: 'pop-culture', type: 'static' },
  { text: 'miyazaki films are 90% characters going somewhere.', category: 'pop-culture', type: 'static' },
  { text: 'studio ghibli would not approve of you staying in.', category: 'pop-culture', type: 'static' },
  { text: 'luffy left home for treasure. yours is hidden among your saved pins.', category: 'pop-culture', type: 'static' },
  { text: 'kakashi reads on the move. multitask.', category: 'pop-culture', type: 'static' },
  { text: 'spider-man has the whole city memorized. start small.', category: 'pop-culture', type: 'static' },
  { text: "avatar aang went to all four corners. you've been to two cafés.", category: 'pop-culture', type: 'static' },
  { text: "the doctor's TARDIS isn't real. an auto-rickshaw is.", category: 'pop-culture', type: 'static' },
  { text: 'naruto ran across continents in sandals. just walk.', category: 'pop-culture', type: 'static' },
  { text: 'hayao miyazaki took thirty years. start tomorrow.', category: 'pop-culture', type: 'static' },
  { text: 'arya stark had a bigger to-do list than you.', category: 'pop-culture', type: 'static' },
  { text: 'stranger things happen. usually outside.', category: 'pop-culture', type: 'static' },
  { text: 'forrest gump just kept running. you can manage three blocks.', category: 'pop-culture', type: 'static' },
  { text: 'one piece is 1000+ episodes about going somewhere. so go.', category: 'pop-culture', type: 'static' },
  { text: 'wall-e went to space for love. you can go for tacos.', category: 'pop-culture', type: 'static' },
  { text: 'jon snow knew nothing. but he still went north.', category: 'pop-culture', type: 'static' },
  { text: "ash ketchum hasn't been home in 25 years.", category: 'pop-culture', type: 'static' },
  { text: 'doraemon has a door for this. you have shoes.', category: 'pop-culture', type: 'static' },
  { text: 'heisenberg drove an RV across new mexico. less crime, more views.', category: 'pop-culture', type: 'static' },
  { text: "wandering samurai. wandering scholar. wandering you. (it's a tradition.)", category: 'pop-culture', type: 'static' },
  { text: "kick buttowski didn't ride his bike to the kitchen.", category: 'pop-culture', type: 'static' },
  { text: 'indiana jones found the holy grail. you can find brunch.', category: 'pop-culture', type: 'static' },
  { text: 'marty mcfly went thirty years to skateboard somewhere. lazy excuse, gone.', category: 'pop-culture', type: 'static' },
  { text: 'james bond goes to a new country every film. you can too — every possible moment.', category: 'pop-culture', type: 'static' },
  { text: "musashi walked across japan with nothing. you've got wheels of freedom.", category: 'pop-culture', type: 'static' },
  { text: 'christopher mccandless walked into the wild. your nearest trail starts smaller.', category: 'pop-culture', type: 'static' },

  // ===== TAUNTING (25 — 3 dynamic, 22 static) =====
  // Dynamic 1: lazy ratio
  {
    text: "you saved {plannedCount}. you've visited {visitedCount}. that math is rude.",
    category: 'taunting',
    type: 'dynamic',
    conditionId: 'lazy-ratio',
  },
  // Dynamic 2: old pin by month
  {
    text: 'that pin from {monthName} is filing for emancipation.',
    category: 'taunting',
    type: 'dynamic',
    conditionId: 'old-pin-month',
  },
  // Static taunting follows
  { text: '"next weekend" has been next weekend for a while now.', category: 'taunting', type: 'static' },
  { text: 'planned and visited are not the same thing. you know which ones.', category: 'taunting', type: 'static' },
  { text: 'screenshot folder: full. visited folder: shy.', category: 'taunting', type: 'static' },
  { text: 'someday is not on the calendar.', category: 'taunting', type: 'static' },
  { text: 'you opened wayfinder to feel productive. nice.', category: 'taunting', type: 'static' },
  { text: 'close the app. open the door.', category: 'taunting', type: 'static' },
  // Dynamic 3: old named pin
  {
    text: 'the pin labeled "{pinName}" has been waiting longer than your last laundry.',
    category: 'taunting',
    type: 'dynamic',
    conditionId: 'old-pin-named',
  },
  // Static taunting continues
  { text: "that café isn't going to visit itself.", category: 'taunting', type: 'static' },
  { text: 'you\'ve been "meaning to go" since the iPhone got a USB-C port.', category: 'taunting', type: 'static' },
  { text: "you've planned more than you've packed.", category: 'taunting', type: 'static' },
  { text: 'the future you who goes there is being patient. very patient.', category: 'taunting', type: 'static' },
  { text: "you bookmarked it. you didn't summon it.", category: 'taunting', type: 'static' },
  { text: "there's a 0% chance of going if you stay here.", category: 'taunting', type: 'static' },
  { text: 'tagged "date-worthy." dated: never.', category: 'taunting', type: 'static' },
  { text: 'you reorganized your collections instead of visiting one.', category: 'taunting', type: 'static' },
  { text: 'another saved post. another unvisited pin. equilibrium.', category: 'taunting', type: 'static' },
  { text: "the kitchen called. it's also a place. doesn't count.", category: 'taunting', type: 'static' },
  { text: "you're collecting places like pokémon and using none of them.", category: 'taunting', type: 'static' },
  { text: 'wishlist: ambitious. weekend: indoor.', category: 'taunting', type: 'static' },
  { text: 'seven tabs open. zero shoes on.', category: 'taunting', type: 'static' },
  { text: 'you read this instead of leaving. fascinating choice.', category: 'taunting', type: 'static' },
  { text: 'shall we call in a war room. just so you could step out.', category: 'taunting', type: 'static' },
  { text: 'you\'ve been "almost ready to leave" for two weekends.', category: 'taunting', type: 'static' },

  // ===== EMPATHY (20) =====
  { text: 'had a hard week? somewhere out there is a quiet table.', category: 'empathy', type: 'static' },
  { text: 'when in doubt, go outside.', category: 'empathy', type: 'static' },
  { text: 'a coffee in a new place hits different.', category: 'empathy', type: 'static' },
  { text: "you've earned a wander.", category: 'empathy', type: 'static' },
  { text: 'the world will still be heavy tomorrow. go anyway.', category: 'empathy', type: 'static' },
  { text: 'one of those days? short walk. new street. small reset.', category: 'empathy', type: 'static' },
  { text: 'when nothing makes sense, at least the bus is going somewhere.', category: 'empathy', type: 'static' },
  { text: "you don't have to feel ready. just go.", category: 'empathy', type: 'static' },
  { text: 'small trips count too. they all count.', category: 'empathy', type: 'static' },
  { text: 'tired is a fine reason to leave the house, actually.', category: 'empathy', type: 'static' },
  { text: "you've been carrying a lot. set it down somewhere new.", category: 'empathy', type: 'static' },
  { text: "it's okay if you only stay an hour.", category: 'empathy', type: 'static' },
  { text: 'the sad ones make for the best small adventures.', category: 'empathy', type: 'static' },
  { text: 'find a bench. a new bench. just sit there.', category: 'empathy', type: 'static' },
  { text: 'movement is medicine. sometimes a slow medicine.', category: 'empathy', type: 'static' },
  { text: 'one new street is enough today.', category: 'empathy', type: 'static' },
  { text: 'nothing has to be productive about this.', category: 'empathy', type: 'static' },
  { text: "the pin doesn't care if you cry there.", category: 'empathy', type: 'static' },
  { text: "you don't have to come back happy. just come back.", category: 'empathy', type: 'static' },
  { text: 'some trips are just to remember you can.', category: 'empathy', type: 'static' },

  // ===== ENCOURAGING (20) =====
  { text: "one stop. that's all today asks.", category: 'encouraging', type: 'static' },
  { text: "you don't need a whole weekend. an hour will do.", category: 'encouraging', type: 'static' },
  { text: 'left turn. just for once.', category: 'encouraging', type: 'static' },
  { text: "take the bus you don't recognize.", category: 'encouraging', type: 'static' },
  { text: 'the weather is fine. you knew it would be.', category: 'encouraging', type: 'static' },
  { text: 'go before it gets famous.', category: 'encouraging', type: 'static' },
  { text: 'your future self has already thanked you.', category: 'encouraging', type: 'static' },
  { text: 'small streets. big stories.', category: 'encouraging', type: 'static' },
  { text: 'one of these pins is calling. answer.', category: 'encouraging', type: 'static' },
  { text: 'travel light. annotate heavy.', category: 'encouraging', type: 'static' },
  { text: 'you can sleep in your own city.', category: 'encouraging', type: 'static' },
  { text: "a stranger's recommendation beats 200 reviews.", category: 'encouraging', type: 'static' },
  { text: 'shoes on. notes off. go.', category: 'encouraging', type: 'static' },
  { text: "the best trip is the one you almost didn't take.", category: 'encouraging', type: 'static' },
  { text: 'the door is right there.', category: 'encouraging', type: 'static' },
  { text: "start with the closest pin. you'll figure out the rest.", category: 'encouraging', type: 'static' },
  { text: 'nothing on the schedule? perfect.', category: 'encouraging', type: 'static' },
  { text: "it's a fine day to lose track of time.", category: 'encouraging', type: 'static' },
  { text: 'the city is open. permission granted.', category: 'encouraging', type: 'static' },
  { text: 'five minutes of getting ready. two hours of glad you did.', category: 'encouraging', type: 'static' },

  // ===== AMBIENT (25) =====
  { text: 'the side street always wins.', category: 'ambient', type: 'static' },
  { text: '3am pins age the best.', category: 'ambient', type: 'static' },
  { text: 'maps are advice, not orders.', category: 'ambient', type: 'static' },
  { text: 'somewhere, a place is being yours without asking.', category: 'ambient', type: 'static' },
  { text: 'every pin is a memory waiting for permission.', category: 'ambient', type: 'static' },
  { text: 'the map remembers what the camera forgets.', category: 'ambient', type: 'static' },
  { text: 'wander often, wonder always.', category: 'ambient', type: 'static' },
  { text: 'small streets keep loud secrets.', category: 'ambient', type: 'static' },
  { text: 'a quiet alley can change a whole trip.', category: 'ambient', type: 'static' },
  { text: 'some days you map. some days you wander.', category: 'ambient', type: 'static' },
  { text: 'the best route surprises you.', category: 'ambient', type: 'static' },
  { text: "some places age in your head. visit them before they don't match.", category: 'ambient', type: 'static' },
  { text: 'the world is mostly somewhere else.', category: 'ambient', type: 'static' },
  { text: 'you live in a city that other people pin.', category: 'ambient', type: 'static' },
  { text: "a place is just a stranger you haven't met yet.", category: 'ambient', type: 'static' },
  { text: 'the pin is yours. the place is everyone\'s.', category: 'ambient', type: 'static' },
  { text: 'all maps are just confessions of where someone wanted to be.', category: 'ambient', type: 'static' },
  { text: 'distance is a small lie. start walking and see.', category: 'ambient', type: 'static' },
  { text: 'saved places are tiny letters to a future self.', category: 'ambient', type: 'static' },
  { text: 'the route is the trip. the destination is just the period.', category: 'ambient', type: 'static' },
  { text: 'there are more streets than weekends.', category: 'ambient', type: 'static' },
  { text: 'you cannot pin every place. you can pin one more today.', category: 'ambient', type: 'static' },
  { text: 'cities forget you exist on tuesdays. tuesdays are for going.', category: 'ambient', type: 'static' },
  { text: 'somewhere it is morning and someone is opening their café.', category: 'ambient', type: 'static' },
  { text: 'a map at night is a different map.', category: 'ambient', type: 'static' },
];
  
