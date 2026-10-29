/* Ready-made sample documents so users can explore Easier without a file.
   Both texts contain definitional sentences (flashcards), keyword-rich
   sentences (mind map) and a few regulation-style lines ("Laws & key terms" mode). */

export const SAMPLE_EN = {
  title: 'Sample: Photosynthesis — How Plants Make Food',
  text: `Photosynthesis is the process by which green plants make their own food using sunlight, water and carbon dioxide. Chlorophyll is the green pigment inside leaf cells that captures light energy from the sun. Oxygen is released as a by-product of photosynthesis, which is why forests are often called the lungs of the planet.
Photosynthesis happens inside organelles called chloroplasts, which are most abundant in the mesophyll layer of a leaf. Water is absorbed from the soil by the roots and travels upward through the xylem vessels. Carbon dioxide enters the leaf through tiny pores called stomata, which open and close to balance gas exchange with water loss.
Light energy splits water molecules into hydrogen and oxygen, and the hydrogen is combined with carbon dioxide to build glucose. Glucose is a simple sugar that stores chemical energy the plant can use for growth, repair and reproduction. Plants that make their own food from simple substances are called autotrophs, while organisms that must eat other organisms for energy are called heterotrophs.
The rate of photosynthesis depends on several factors: light intensity, carbon dioxide concentration, temperature and the amount of water available. Very high temperatures slow photosynthesis because the enzymes that drive it begin to break down. At night, when there is no light, plants switch from producing energy to consuming the glucose they stored during the day.
In nature, photosynthesis sits at the base of almost every food chain. Herbivores eat plants for energy, and carnivores eat the herbivores, so every animal depends directly or indirectly on the sugars plants produce. Fossil fuels such as coal and oil are the compressed remains of ancient plants, which means burning them releases solar energy captured millions of years ago.
Plant protection regulations: Article 1 of the Conservation Act defines a protected plant as any species listed in the national register. Article 4 states that cutting protected trees requires a written permit from the environment authority. Section 7 provides that violators shall pay compensation equal to the ecological value of the damaged plant life.
Understanding photosynthesis helps farmers increase crop yields, helps city planners choose trees that clean the air, and reminds students that almost all the energy powering life on Earth begins in a green leaf.`,
};

export const SAMPLE_AR = {
  title: 'نموذج: البناء الضوئي — كيف يصنع النبات غذاءه',
  text: `البناء الضوئي هو العملية التي يصنع بها النبات الأخضر غذاءه بنفسه باستخدام ضوء الشمس والماء وثاني أكسيد الكربون. الكلوروفيل هو الصبغة الخضراء داخل خلايا الورقة التي تلتقط الطاقة الضوئية من الشمس. ينتج الأكسجين من عملية البناء الضوئي كنتيجة ثانوية، ولذلك تُسمَّى الغابات رئة الكوكب.
يحدث البناء الضوئي داخل عضيات تسمى البلاستيدات الخضراء، وهي أكثر وفرة في الطبقة الوسطى من الورقة. يمتص النبات الماء من التربة عبر الجذور ويصعد صعودًا داخل الأوعية الخشبية. يدخل ثاني أكسيد الكربون إلى الورقة من خلال ثغور دقيقة تفتح وتغلق لتوازن تبادل الغازات مع فقد الماء.
تحلل الطاقة الضوئية جزيئات الماء إلى هيدروجين وأكسجين، ثم يُدمَج الهيدروجين مع ثاني أكسيد الكربون لبناء الجلوكوز. الجلوكوز هو سكر بسيط يخزن الطاقة الكيميائية التي يستخدمها النبات للنمو والإصلاح والتكاثر. تسمى الكائنات التي تصنع غذاءها من مواد بسيطة كائنات ذاتية التغذية، أما الكائنات التي تحتاج إلى أكل كائنات أخرى فتسمى غير ذاتية التغذية.
يعتمد معدل البناء الضوئي على عدة عوامل: شدة الضوء وتركيز ثاني أكسيد الكربون ودرجة الحرارة وكمية الماء المتاحة. تؤدي الحرارة العالية جدًا إلى إبطاء البناء الضوئي لأن الإنزيمات التي تقوده تبدأ بالتحلل. أما ليلًا، حين يغيب الضوء، فيتحول النبات من إنتاج الطاقة إلى استهلاك الجلوكوز الذي خزنه خلال النهار.
في الطبيعة يشكل البناء الضوئي قاعدة كل سلسلة غذاء تقريبًا. العواشب تأكل النباتات للحصول على الطاقة، والحيوانات اللاحمة تأكل العواشب، لذلك يعتمد كل حيوان مباشرة أو غير مباشرة على السكريات التي تنتجها النباتات. الوقود الأحفوري مثل الفحم والنفط هو بقايا نباتات قديمة مضغوطة، ما يعني أن حرقها يطلق طاقة شمسية التُقطت قبل ملايين السنين.
أنظمة حماية النبات: تُعرِّف المادة الأولى من قانون الحماية النبات المحمي بأنه أي نوع مقيد في السجل الوطني. تنص المادة الرابعة على أن قطع الأشجار المحمية يتطلب تصريحًا كتابيًا من هيئة البيئة. وتنص المادة السابعة على أن المخالفين يدفعون تعويضًا مساويًا للقيمة البيئية للأضرار.
فهم البناء الضوئي يساعد المزارعين على زيادة إنتاج المحاصيل، ويساعد مخططي المدن على اختيار أشجار تنقي الهواء، ويُذكِّر الطلاب بأن كل الطاقة التي تحرك الحياة على الأرض تبدأ في ورقة خضراء.`,
};

export function getSample(lang: 'en' | 'ar') {
  return lang === 'ar' ? SAMPLE_AR : SAMPLE_EN;
}
