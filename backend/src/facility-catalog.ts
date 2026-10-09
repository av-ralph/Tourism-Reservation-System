export const facilityCatalog = [
 ['Front Office Area','Guest services','Guest reception, check-in, and front office operations.'],
 ['Mini Function Room','Events','Event planning, presentations, and small gatherings.'],
 ['Dining Area','Food & beverage','Table service, dining etiquette, and restaurant operations.'],
 ['Harmonia Mini-Hotel','Accommodation','Housekeeping and hospitality service practice.'],
 ['Lunara Mini-Hotel','Accommodation','Room preparation and guest accommodation.'],
 ['Hot Kitchen','Culinary','Hands-on culinary preparation and cooking activities.'],
 ['Cold Kitchen','Culinary','Cold food preparation, plating, and presentation.'],
 ['Laundry Area','Housekeeping','Linen care, laundry procedures, and equipment handling.'],
 ['Bar Area','Food & beverage','Beverage preparation and professional bar service.'],
 ['Computer Laboratory MH 302','Technology','Hospitality software and computer-based activities.'],
].map(([name,category,description],index)=>({id:`facility-${String(index+1).padStart(2,'0')}`,name:name!,category:category!,description:description!,status:'Available',reason:''}));
