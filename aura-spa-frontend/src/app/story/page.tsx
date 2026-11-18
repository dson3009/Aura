"use client";

import { useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";

const storyCopy = {
  vi: {
    heroEyebrow: "HÀNH TRÌNH TỰ TẠI",
    heroTitle: "Nơi Tâm Hồn Tìm Về Sự Tĩnh Lặng",
    heroDesc:
      "Tại AuraSpa, chúng tôi tin rằng vẻ đẹp thật sự khởi nguồn từ sự bình yên nội tại và sự cân bằng hoàn hảo giữa thân - tâm - trí.",
    missionTitle: "Sứ Mệnh & Câu Chuyện Của Aura",
    missionDesc:
      "Khởi nguồn từ mong muốn tạo ra một ốc đảo tách biệt khỏi nhịp sống hiện đại, AuraSpa không chỉ là một trung tâm trị liệu mà là một không gian chữa lành được vận hành bằng sự tinh tế, an toàn và thấu hiểu.",
    quote:
      "Chúng tôi không chỉ chăm sóc làn da, chúng tôi xoa dịu áp lực và đánh thức các giác quan bằng những tinh hoa thuần khiết nhất từ thiên nhiên.",
    coreLabel: "Giá trị cốt lõi",
    coreValue: "Sự chân thành trong từng cử chỉ chạm.",
    teamLabel: "Đội ngũ của chúng tôi",
    teamTitle: "Những Người Kiến Tạo Sự Tĩnh Lặng",
    teamDesc:
      "Những đôi tay tài hoa cùng kiến thức chuyên sâu về liệu pháp tự nhiên sẽ đồng hành cùng bạn trên từng bước của hành trình phục hồi.",
    founderLabel: "Nhà sáng lập",
    founderName: "Linh Chi",
    founderDesc:
      "Người truyền cảm hứng về lối sống tỉnh thức và các liệu pháp thảo dược Á Đông qua hơn 15 năm nghiên cứu wellness.",
    therapyTitle: "Liệu Pháp Chữa Lành",
    therapyDesc: "15+ chuyên gia giàu kinh nghiệm được đào tạo theo tiêu chuẩn dịch vụ chuyên nghiệp.",
    mindfulnessTitle: "Tinh Thần Chánh Niệm",
    mindfulnessDesc: "Không gian và quy trình được thiết kế để khách hàng thư giãn sâu, phục hồi năng lượng bền vững.",
    advisorLabel: "Cố vấn chuyên môn",
    advisorName: "BS. Minh Trí",
    advisorDesc:
      "Tiến sĩ y khoa với hơn 20 năm kinh nghiệm về y học tái tạo, dinh dưỡng wellness và chăm sóc an toàn trước liệu trình.",
    viewProfile: "Xem hồ sơ",
    profileLabel: "Hồ sơ chuyên môn",
    expertiseLabel: "Chuyên môn",
    expertise:
      "Y học tái tạo, dinh dưỡng wellness, chăm sóc da không xâm lấn và đánh giá chống chỉ định trước liệu trình.",
    experienceLabel: "Kinh nghiệm",
    experience: "20+ năm tư vấn lâm sàng và thiết kế phác đồ chăm sóc cá nhân hóa.",
    roleLabel: "Vai trò tại AuraSpa",
    role1: "Kiểm duyệt tiêu chuẩn an toàn liệu trình.",
    role2: "Đào tạo kỹ thuật viên về nhận diện rủi ro sức khỏe.",
    role3: "Tư vấn các hồ sơ cần lưu ý trước khi đặt lịch.",
    spaceLabel: "Không gian Sanctuary",
    spaceTitle: "Kiến Trúc Chạm Đến Cảm Xúc",
    spaceDesc:
      "Sử dụng vật liệu tự nhiên, ánh sáng dịu và nhịp vận hành chậm rãi, AuraSpa được thiết kế để kích hoạt trạng thái thư giãn ngay từ bước chân đầu tiên.",
    roomCount: "Phòng VIP riêng biệt",
    roomDesc: "Cá nhân hóa trải nghiệm tuyệt đối.",
    gardenCount: "Vườn thiền lộ thiên",
    gardenDesc: "Hòa mình cùng hơi thở thiên nhiên.",
    ctaTitle: "Sẵn sàng cho một khởi đầu mới?",
    ctaDesc: "Hãy để chúng tôi đồng hành cùng bạn trên hành trình chăm sóc bản thân một cách trọn vẹn và tinh tế nhất.",
    book: "Đặt lịch hẹn",
    consult: "Tư vấn miễn phí",
  },
  en: {
    heroEyebrow: "A RITUAL OF RENEWAL",
    heroTitle: "Where The Mind Returns To Stillness",
    heroDesc:
      "At AuraSpa, we believe true beauty begins with inner calm and the quiet balance of body, mind and spirit.",
    missionTitle: "The Mission & Story Behind Aura",
    missionDesc:
      "Born from the desire to create a calm retreat from modern life, AuraSpa is more than a treatment center. It is a healing space operated with care, safety and refined hospitality.",
    quote:
      "We do not simply care for the skin. We ease pressure, awaken the senses and bring guests closer to nature's purest rituals.",
    coreLabel: "Core value",
    coreValue: "Sincere care in every thoughtful touch.",
    teamLabel: "Our team",
    teamTitle: "The People Behind The Calm",
    teamDesc:
      "Skilled hands and deep knowledge of natural therapy guide every guest through a restorative wellness journey.",
    founderLabel: "Founder",
    founderName: "Linh Chi",
    founderDesc:
      "An advocate of mindful living and Eastern botanical therapy with over 15 years of wellness research.",
    therapyTitle: "Healing Therapy",
    therapyDesc: "15+ experienced specialists trained to professional service standards.",
    mindfulnessTitle: "Mindful Care",
    mindfulnessDesc: "Spaces and rituals designed to help guests relax deeply and recover sustainable energy.",
    advisorLabel: "Medical Advisor",
    advisorName: "Dr. Minh Tri",
    advisorDesc:
      "A medical doctor with over 20 years of experience in regenerative care, wellness nutrition and safe pre-treatment consultation.",
    viewProfile: "View Profile",
    profileLabel: "Professional Profile",
    expertiseLabel: "Expertise",
    expertise:
      "Regenerative medicine, wellness nutrition, non-invasive skin care and pre-treatment contraindication review.",
    experienceLabel: "Experience",
    experience: "20+ years of clinical consultation and personalized care plan design.",
    roleLabel: "Role at AuraSpa",
    role1: "Review treatment safety standards.",
    role2: "Train therapists to identify health risk indicators.",
    role3: "Advise profiles that require attention before booking.",
    spaceLabel: "Sanctuary Space",
    spaceTitle: "Architecture That Calms The Senses",
    spaceDesc:
      "Natural materials, soft lighting and a slower service rhythm help AuraSpa create a state of calm from the moment guests arrive.",
    roomCount: "Private VIP rooms",
    roomDesc: "A highly personalized wellness experience.",
    gardenCount: "Open-air meditation garden",
    gardenDesc: "A gentle connection with nature.",
    ctaTitle: "Ready for a new beginning?",
    ctaDesc: "Let us accompany you on a complete and refined self-care journey.",
    book: "Book an Appointment",
    consult: "Free Consultation",
  },
};

export default function StoryPage() {
  const { language } = useLanguage();
  const copy = storyCopy[language];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("active");
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" },
    );

    document.querySelectorAll(".reveal-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="pt-20 overflow-x-hidden bg-background text-on-surface">
      <section className="relative h-[85vh] flex items-center justify-center text-center px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover brightness-75 transition-transform duration-[10s] hover:scale-110"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAu87l45EhVOVlDbK7Fa20sBjuVnHqx3warFol5LeEieqo65sEJbgekGUUKIuToMd3639WIEOwC6oCO7EdGsoSW-cMIgeCBC6Xm7upNOkE7PFHQo7UxYtBntmzuhhJ3UkitY2ShM5N9tAZwhJxnDOwrFKjEX6WD_NVRCZ6bA80Grd2k3w2B0uvvVUELAfFRTwOaUPI5jIPeJjgesJisxk-siwKfLivrRuWzd65QuxC0_zGGDiTZXmBzU5BjiXy-PhG1iQIWl5QbDiU"
            alt="AuraSpa story hero"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />
        </div>
        <div className="relative z-10 max-w-5xl reveal-on-scroll">
          <span className="font-label-md text-label-md text-white/80 bg-primary/20 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full mb-8 inline-block tracking-[0.2em] uppercase">
            {copy.heroEyebrow}
          </span>
          <h1 className="font-display-lg text-display-lg md:text-[80px] text-white mb-8 leading-[1.1]">
            {copy.heroTitle}
          </h1>
          <p className="font-body-lg text-body-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            {copy.heroDesc}
          </p>
        </div>
      </section>

      <section className="py-section-padding-desktop px-8 max-w-container-max mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5 reveal-on-scroll">
            <div className="mb-6 h-px w-20 bg-primary/30" />
            <h2 className="font-headline-lg text-headline-lg text-primary mb-10 leading-tight">
              {copy.missionTitle}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 leading-relaxed">
              {copy.missionDesc}
            </p>
            <div className="relative py-8 px-10 bg-surface-container-low border-l-2 border-primary/40">
              <span className="material-symbols-outlined absolute top-4 left-4 text-primary/20 scale-150" style={{ fontVariationSettings: "'FILL' 1" }}>
                format_quote
              </span>
              <p className="font-body-md text-body-md text-on-surface italic leading-relaxed">&quot;{copy.quote}&quot;</p>
            </div>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 reveal-on-scroll" style={{ transitionDelay: "200ms" }}>
            <div className="relative">
              <div className="relative z-10 overflow-hidden shadow-2xl">
                <img
                  className="w-full h-[600px] object-cover hover:scale-105 transition-transform duration-700"
                  src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1400&q=90"
                  alt="AuraSpa wellness ritual"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-surface p-6 shadow-xl border border-outline-variant/10 max-w-[240px] hidden xl:block z-20">
                <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest mb-2">{copy.coreLabel}</p>
                <p className="font-body-md text-body-md text-on-surface-variant italic">{copy.coreValue}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container py-section-padding-desktop px-8">
        <div className="max-w-container-max mx-auto">
          <div className="max-w-3xl mb-20 reveal-on-scroll">
            <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">{copy.teamLabel}</span>
            <h2 className="font-headline-lg text-headline-lg text-primary mt-4 mb-6">{copy.teamTitle}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">{copy.teamDesc}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8 group relative overflow-hidden bg-surface reveal-on-scroll min-h-[500px]">
              <img
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-80"
                src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=1400&q=85"
                alt="AuraSpa founder"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-12 w-full text-white">
                <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-[0.3em]">{copy.founderLabel}</span>
                <h3 className="font-headline-md text-headline-md mt-2 mb-4">{copy.founderName}</h3>
                <p className="font-body-md text-body-md text-white/80 max-w-md leading-relaxed">{copy.founderDesc}</p>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-8">
              <div className="flex-1 bg-primary text-on-primary p-10 flex flex-col justify-between reveal-on-scroll" style={{ transitionDelay: "100ms" }}>
                <span className="material-symbols-outlined text-5xl">spa</span>
                <div>
                  <h4 className="font-headline-sm text-headline-sm mb-3">{copy.therapyTitle}</h4>
                  <p className="font-body-md text-body-md opacity-80">{copy.therapyDesc}</p>
                </div>
              </div>
              <div className="flex-1 bg-surface p-10 flex flex-col justify-between border border-outline-variant/10 reveal-on-scroll" style={{ transitionDelay: "200ms" }}>
                <span className="material-symbols-outlined text-5xl text-primary">self_improvement</span>
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface mb-3">{copy.mindfulnessTitle}</h4>
                  <p className="font-body-md text-body-md text-on-surface-variant">{copy.mindfulnessDesc}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-12 bg-white p-8 flex flex-col md:flex-row gap-10 items-center border border-outline-variant/10 reveal-on-scroll shadow-sm" style={{ transitionDelay: "300ms" }}>
              <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0 border-4 border-surface-container">
                <img className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=85" alt="Medical advisor" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="font-label-md text-label-md text-primary tracking-widest uppercase">{copy.advisorLabel}</h4>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1 mb-2">{copy.advisorName}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{copy.advisorDesc}</p>
              </div>
              <a href="#doctor-profile" className="border border-outline px-8 py-3 font-label-md text-label-md hover:bg-primary/5 transition-colors tracking-widest uppercase">
                {copy.viewProfile}
              </a>
            </div>

            <div id="doctor-profile" className="md:col-span-12 bg-surface p-8 md:p-10 border border-outline-variant/10 reveal-on-scroll" style={{ transitionDelay: "350ms" }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div>
                  <p className="font-label-sm text-label-sm text-primary uppercase tracking-[0.2em] mb-3">{copy.profileLabel}</p>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{copy.advisorName}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">{copy.advisorDesc}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest">{copy.expertiseLabel}</p>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">{copy.expertise}</p>
                  </div>
                  <div>
                    <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest">{copy.experienceLabel}</p>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">{copy.experience}</p>
                  </div>
                </div>
                <div className="bg-surface-container-low p-6 border-l-2 border-primary/40">
                  <p className="font-label-sm text-label-sm text-primary uppercase tracking-widest mb-3">{copy.roleLabel}</p>
                  <ul className="font-body-md text-body-md text-on-surface-variant space-y-2">
                    <li>{copy.role1}</li>
                    <li>{copy.role2}</li>
                    <li>{copy.role3}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-section-padding-desktop px-8 max-w-container-max mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-24 items-center">
          <div className="w-full lg:w-1/2 reveal-on-scroll order-2 lg:order-1">
            <div className="grid grid-cols-2 gap-6 h-[700px]">
              <div className="col-span-2 relative h-[60%] overflow-hidden">
                <img className="w-full h-full object-cover shadow-2xl" src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=90" alt="AuraSpa treatment room" />
              </div>
              <div className="relative overflow-hidden">
                <img alt="Spa interior details" className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=90" />
              </div>
              <div className="bg-surface-container p-8 flex items-center justify-center text-center">
                <div>
                  <p className="font-headline-md text-headline-md text-primary">Zen</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-2 tracking-widest">{copy.spaceTitle}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 reveal-on-scroll order-1 lg:order-2" style={{ transitionDelay: "200ms" }}>
            <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">{copy.spaceLabel}</span>
            <h2 className="font-headline-lg text-headline-lg text-primary mt-4 mb-10 leading-tight">{copy.spaceTitle}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed mb-10">{copy.spaceDesc}</p>
            <div className="grid grid-cols-2 gap-12">
              <div className="border-l-2 border-primary/20 pl-6">
                <span className="text-5xl font-headline-md text-primary">05</span>
                <p className="text-label-md text-on-surface-variant font-bold mt-2 tracking-widest uppercase">{copy.roomCount}</p>
                <p className="text-body-md text-on-surface-variant/70 mt-1">{copy.roomDesc}</p>
              </div>
              <div className="border-l-2 border-primary/20 pl-6">
                <span className="text-5xl font-headline-md text-primary">01</span>
                <p className="text-label-md text-on-surface-variant font-bold mt-2 tracking-widest uppercase">{copy.gardenCount}</p>
                <p className="text-body-md text-on-surface-variant/70 mt-1">{copy.gardenDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-32 text-center px-8 reveal-on-scroll">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-headline-lg text-headline-lg text-primary mb-8">{copy.ctaTitle}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-12 leading-relaxed">{copy.ctaDesc}</p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a href="/booking" className="bg-primary text-on-primary px-12 py-5 font-label-md text-label-md tracking-[0.2em] hover:bg-primary/90 transition-all shadow-lg uppercase">
              {copy.book}
            </a>
            <a href="/contact" className="border-2 border-primary text-primary px-12 py-5 font-label-md text-label-md tracking-[0.2em] hover:bg-primary/5 transition-all uppercase">
              {copy.consult}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
