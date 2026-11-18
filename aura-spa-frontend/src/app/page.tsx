"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

const homeText = {
  vi: {
    eyebrow: "ĐÁNH THỨC GIÁC QUAN",
    title: "Nơi tĩnh lặng gặp gỡ sự sang trọng",
    desc: "Trải nghiệm hành trình phục hồi thân - tâm - trí tại AuraSpa, nơi mỗi liệu trình được thiết kế để mang lại sự cân bằng cho riêng bạn.",
    book: "Đặt lịch ngay",
    viewServices: "Xem dịch vụ",
    years: "15+",
    yearsLabel: "Năm kinh nghiệm trong ngành wellness",
    philosophyTitle: "Triết lý của sự tĩnh lặng và tái tạo",
    philosophyQuote: "Chúng tôi tin rằng sự sang trọng thật sự bắt đầu từ cảm giác bình yên trong tâm hồn.",
    philosophyDesc: "AuraSpa tạo nên một không gian thoát ly khỏi nhịp sống vội vã, kết hợp thảo mộc truyền thống, kỹ thuật trị liệu hiện đại và sự chăm sóc tinh tế.",
    point1: "Nguyên liệu hữu cơ tinh khiết",
    point2: "Kỹ thuật viên được đào tạo chuyên sâu",
    point3: "Không gian riêng tư, yên tĩnh",
    featuredTitle: "Dịch vụ nổi bật",
    featuredDesc: "Khám phá các liệu trình được yêu thích nhất, được thiết kế để chăm sóc sức khỏe, làn da và trạng thái thư giãn của bạn.",
    hotStone: "Massage đá nóng núi lửa",
    hotStoneDesc: "Giải tỏa căng cơ sâu bằng đá nóng, tinh dầu ấm và nhịp massage chậm rãi.",
    facial: "Chăm sóc da mặt chuyên sâu",
    facialDesc: "Làm sạch, cấp ẩm và phục hồi hàng rào bảo vệ da bằng liệu trình dịu nhẹ.",
    package: "Gói tắm an wellness",
    packageDesc: "Một hành trình trọn vẹn gồm tắm thảo mộc, massage và trà thư giãn.",
    from: "Từ",
    testimonials: "Khách hàng nói gì",
    ctaTitle: "Sẵn sàng cho hành trình tái tạo?",
    ctaDesc: "Đặt lịch hôm nay để AuraSpa chuẩn bị liệu trình phù hợp với nhu cầu của bạn.",
    call: "Gọi tư vấn: 1900 8888",
    quickBook: "Đặt lịch nhanh",
    footerDesc: "Nâng tầm trải nghiệm wellness tại Việt Nam với tiêu chuẩn chuyên nghiệp và tinh thần phục vụ tận tâm.",
  },
  en: {
    eyebrow: "AWAKEN THE SENSES",
    title: "Where stillness meets refined luxury",
    desc: "Begin a restorative mind-body journey at AuraSpa, where every treatment is designed around your own sense of balance.",
    book: "Book Now",
    viewServices: "View Services",
    years: "15+",
    yearsLabel: "Years of wellness experience",
    philosophyTitle: "A philosophy of calm and renewal",
    philosophyQuote: "We believe true luxury begins with a quiet mind.",
    philosophyDesc: "AuraSpa creates a retreat from the rush of daily life, blending traditional botanicals, modern therapy techniques and attentive care.",
    point1: "Pure organic ingredients",
    point2: "Professionally trained therapists",
    point3: "Private and peaceful treatment rooms",
    featuredTitle: "Featured Services",
    featuredDesc: "Explore our most loved treatments, designed to care for your wellbeing, skin and state of relaxation.",
    hotStone: "Volcanic Hot Stone Massage",
    hotStoneDesc: "Release deep muscle tension with warm stones, aromatic oils and slow therapeutic pressure.",
    facial: "Advanced Facial Care",
    facialDesc: "Cleanse, hydrate and restore your skin barrier with a gentle, targeted treatment.",
    package: "Serenity Wellness Package",
    packageDesc: "A complete ritual with herbal bath, massage and calming tea.",
    from: "From",
    testimonials: "What Guests Say",
    ctaTitle: "Ready for your renewal journey?",
    ctaDesc: "Book today and let AuraSpa prepare a treatment plan that fits your needs.",
    call: "Call for advice: 1900 8888",
    quickBook: "Quick booking",
    footerDesc: "Elevating wellness in Vietnam with professional standards and thoughtful service.",
  },
};

const serviceImages = [
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80",
];

export default function Home() {
  const { language } = useLanguage();
  const copy = homeText[language];

  const services = [
    { title: copy.hotStone, desc: copy.hotStoneDesc, price: "850.000đ", image: serviceImages[0] },
    { title: copy.facial, desc: copy.facialDesc, price: "690.000đ", image: serviceImages[1] },
    { title: copy.package, desc: copy.packageDesc, price: "1.200.000đ", image: serviceImages[2] },
  ];

  return (
    <main className="bg-background text-on-surface selection:bg-primary-fixed selection:text-primary">
      <header className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            alt="AuraSpa treatment room"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBfEcMgyBZnD0MUmrtv3-X67Z7DqXTHs3MefWBBkOV_9-A6lsjw3SA6dTGSiL9tW6rIdwdlei3FqSG4cCTkHW31EepcFQjCI6WkvAwmp3RnE9jWKiJ8Z74zbm22RZjbDMxkYE6DQqefnKcsRk4BBi-jJWm_oRsrXzpz32U3Leew3NC6Kj3MElZV0K2VEMG5jYlAimGu5iENlB9XJPoFrLtfdCIY9nBpWkE2gDguIF06f_9JjGGozpEs455_HPhnJgN3fddi_-EA60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/55 to-background/10" />
        </div>
        <div className="relative z-10 max-w-container-max mx-auto px-gutter w-full pt-24">
          <div className="max-w-2xl">
            <span className="font-label-md text-label-md text-secondary tracking-[0.2em] mb-4 block uppercase">{copy.eyebrow}</span>
            <h1 className="font-display-lg text-display-lg text-primary mb-6">{copy.title}</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 leading-relaxed">{copy.desc}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/booking" className="bg-primary text-on-primary px-10 py-4 font-label-md text-label-md hover:opacity-90 transition-all shadow-md text-center">
                {copy.book}
              </Link>
              <Link href="/services" className="border border-primary text-primary px-10 py-4 font-label-md text-label-md hover:bg-primary/5 transition-all text-center">
                {copy.viewServices}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="py-section-padding-desktop bg-surface-container-lowest">
        <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 md:grid-cols-12 gap-gutter items-center">
          <div className="md:col-span-5 relative">
            <div className="aspect-[4/5] overflow-hidden rounded-sm">
              <img
                alt="Spa therapist preparing treatment"
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1000&q=80"
              />
            </div>
            <div className="absolute -bottom-8 -right-4 md:-right-8 w-44 h-44 bg-surface-container p-6 flex flex-col justify-center border border-outline-variant shadow-sm">
              <span className="font-display-lg text-headline-lg text-primary block">{copy.years}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{copy.yearsLabel}</span>
            </div>
          </div>
          <div className="md:col-span-6 md:col-start-7 mt-14 md:mt-0">
            <h2 className="font-headline-lg text-headline-lg text-primary mb-8 leading-tight">{copy.philosophyTitle}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6 italic">&quot;{copy.philosophyQuote}&quot;</p>
            <p className="font-body-md text-body-md text-on-surface-variant mb-8 leading-relaxed">{copy.philosophyDesc}</p>
            <ul className="space-y-4">
              {[copy.point1, copy.point2, copy.point3].map((point) => (
                <li key={point} className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="font-body-md text-body-md font-medium">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-section-padding-desktop">
        <div className="max-w-container-max mx-auto px-gutter">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-14">
            <div className="max-w-xl">
              <h2 className="font-headline-lg text-headline-lg text-primary mb-4">{copy.featuredTitle}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{copy.featuredDesc}</p>
            </div>
            <Link className="font-label-md text-label-md text-primary flex items-center gap-2 group" href="/services">
              {copy.viewServices}
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((service) => (
              <Link key={service.title} href="/booking" className="group bg-surface-container-lowest border border-outline-variant/25 rounded-lg overflow-hidden hover:shadow-xl transition-all">
                <div className="aspect-[4/3] overflow-hidden">
                  <img alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={service.image} />
                </div>
                <div className="p-6">
                  <h3 className="font-headline-sm text-headline-sm text-primary mb-3">{service.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-5 leading-relaxed">{service.desc}</p>
                  <span className="font-label-md text-label-md text-primary">{copy.from} {service.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-section-padding-desktop">
        <div className="absolute inset-0">
          <img
            alt="Spa calm background"
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1800&q=85"
          />
          <div className="absolute inset-0 bg-primary/55 backdrop-blur-[1px]" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto text-center px-gutter">
          <h2 className="font-headline-lg text-headline-lg text-on-primary mb-6">{copy.ctaTitle}</h2>
          <p className="font-body-lg text-body-lg text-on-primary/90 mb-10 leading-relaxed">{copy.ctaDesc}</p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Link href="/booking" className="bg-surface text-primary px-12 py-5 font-label-md text-label-md hover:bg-surface-bright transition-all shadow-xl">
              {copy.book}
            </Link>
            <Link href="/contact" className="border-2 border-surface text-surface px-12 py-5 font-label-md text-label-md hover:bg-surface/10 transition-all">
              {copy.call}
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-surface-container-low py-section-padding-desktop">
        <div className="max-w-container-max mx-auto px-gutter">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
            <div className="md:col-span-5">
              <Link className="font-headline-sm text-headline-sm font-medium text-primary mb-6 block" href="/">AuraSpa</Link>
              <p className="font-body-md text-body-md text-on-surface-variant mb-8 max-w-md leading-relaxed">{copy.footerDesc}</p>
            </div>
            <div className="md:col-span-3 md:col-start-7">
              <h4 className="font-label-md text-label-md text-primary mb-6 uppercase tracking-widest">{language === "vi" ? "Khám phá" : "Explore"}</h4>
              <ul className="space-y-4">
                {[
                  { href: "/services", label: language === "vi" ? "Dịch vụ" : "Services" },
                  { href: "/branches", label: language === "vi" ? "Chi nhánh" : "Branches" },
                  { href: "/contact", label: language === "vi" ? "Liên hệ" : "Contact" },
                ].map((item) => (
                  <li key={item.href}><Link className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors" href={item.href}>{item.label}</Link></li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-3">
              <h4 className="font-label-md text-label-md text-primary mb-6 uppercase tracking-widest">{language === "vi" ? "Bản tin" : "Newsletter"}</h4>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">{language === "vi" ? "Nhận bí quyết chăm sóc sức khỏe và ưu đãi mới." : "Receive wellness tips and new offers."}</p>
              <div className="flex border-b border-outline">
                <input suppressHydrationWarning className="bg-transparent border-none py-3 focus:ring-0 text-sm w-full" placeholder={language === "vi" ? "Email của bạn" : "Your email"} type="email" />
                <button className="text-primary p-2" aria-label="Subscribe">
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-label-sm text-label-sm text-on-surface-variant">© 2024 AuraSpa Wellness Retreat. All rights reserved.</p>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Designed for Serenity</span>
          </div>
        </div>
      </footer>

    </main>
  );
}
