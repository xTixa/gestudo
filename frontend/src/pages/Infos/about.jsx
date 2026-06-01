import { useEffect, useRef, useState } from 'react';
import PublicNavbar from '../../components/infos/PublicNavbar';
import PublicFooter from '../../components/infos/PublicFooter';
import foto1 from '../../assets/img/infos/foto1.jpg';
import foto2 from '../../assets/img/infos/foto2.jpg';
import foto3 from '../../assets/img/infos/foto3.jpg';
import foto4 from '../../assets/img/infos/foto4.jpg';
import foto5 from '../../assets/img/infos/foto5.jpg';
import foto6 from '../../assets/img/infos/foto6.jpg';
import foto7 from '../../assets/img/infos/foto7.jpg';
import foto8 from '../../assets/img/infos/foto8.jpg';
import foto9 from '../../assets/img/infos/foto9.jpg';
import foto10 from '../../assets/img/infos/foto10.jpg';
import foto11 from '../../assets/img/infos/foto11.jpg';
import foto12 from '../../assets/img/infos/foto12.jpg';

const instalacoesImages = [
    foto1,
    foto2,
    foto3,
    foto4,
    foto5,
    foto6,
    foto7,
    foto8,
    foto9,
    foto10,
    foto11,
    foto12,
];

export default function InfosAboutPage() {
    const carouselRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    function scrollToIndex(index) {
        if (!carouselRef.current) {
            return;
        }

        const slides = carouselRef.current.children;
        const target = slides[index];

        if (!target) {
            return;
        }

        carouselRef.current.scrollTo({
            left: target.offsetLeft,
            behavior: 'smooth',
        });
    }

    function scrollCarousel(direction) {
        if (!carouselRef.current) {
            return;
        }

        setActiveIndex((prev) => {
            const next =
                direction === 'next'
                    ? (prev + 1) % instalacoesImages.length
                    : (prev - 1 + instalacoesImages.length) %
                      instalacoesImages.length;

            scrollToIndex(next);
            return next;
        });
    }

    useEffect(() => {
        if (isPaused) {
            return;
        }

        const interval = setInterval(() => {
            setActiveIndex((prev) => {
                const next = (prev + 1) % instalacoesImages.length;
                scrollToIndex(next);
                return next;
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [isPaused]);

    function handleCarouselScroll() {
        if (!carouselRef.current) {
            return;
        }

        const scrollLeft = carouselRef.current.scrollLeft;
        const slides = Array.from(carouselRef.current.children);

        let nearestIndex = 0;
        let minDistance = Number.POSITIVE_INFINITY;

        slides.forEach((slide, index) => {
            const distance = Math.abs(slide.offsetLeft - scrollLeft);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });

        setActiveIndex(nearestIndex);
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <PublicNavbar />

            <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
                <h1 className="text-3xl font-bold text-slate-800">Sobre Nós</h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                    A nossa oferta de serviços de apoio ao estudo e estudo
                    acompanhado, explicações em grupo ou individual, visa apoiar
                    os alunos desde do 1º ciclo até ao ensino superior.
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                    O centro de estudos Bloco de Notas dispõe de outros serviços
                    e atividades educativas, formativas e complementares.
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                    Fazem parte da oferta de serviços, atividades extra
                    curriculares, formação profissional, workshops, línguas e
                    traduções, entre outros.
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                    Valorizamos e transmitimos os valores da tolerância,
                    solidariedade, convivência social, paz e igualdade, pois
                    acreditamos serem valores que permitem aos alunos também
                    crescer em sabedoria.
                </p>

                <section className="mt-12">
                    <h2 className="text-2xl font-bold text-slate-800">
                        As Nossas Instalações
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                        Dispomos de instalações recentes e adequadas à prática
                        do ensino. Todas as salas beneficiam de luz natural.
                    </p>
                    <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                        O centro está equipado com equipamento e mobiliário
                        apropriado ao conforto e bem estar dos alunos.
                    </p>
                    <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                        Estamos próximos da maioria da escolas do perímetro
                        urbano, beneficiando de estacionamento disponível e
                        gratuito à porta.
                    </p>

                    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700">
                                Galeria de Instalações
                            </p>
                            <p className="hidden text-xs font-semibold text-slate-500 sm:block">
                                {activeIndex + 1} / {instalacoesImages.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => scrollCarousel('prev')}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollCarousel('next')}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                    Seguinte
                                </button>
                            </div>
                        </div>

                        <div
                            ref={carouselRef}
                            onScroll={handleCarouselScroll}
                            onMouseEnter={() => setIsPaused(true)}
                            onMouseLeave={() => setIsPaused(false)}
                            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
                        >
                            {instalacoesImages.map((image, index) => (
                                <div
                                    key={`${image}-${index}`}
                                    className="aspect-video min-w-[85%] snap-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:min-w-[48%] lg:min-w-[31%]"
                                >
                                    <img
                                        src={image}
                                        alt={`Instalações Bloco de Notas ${index + 1}`}
                                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            {instalacoesImages.map((_, index) => (
                                <button
                                    key={`dot-${index}`}
                                    type="button"
                                    onClick={() => {
                                        setActiveIndex(index);
                                        scrollToIndex(index);
                                    }}
                                    className={`h-2.5 w-2.5 rounded-full transition ${
                                        activeIndex === index
                                            ? 'bg-slate-700 scale-110'
                                            : 'bg-slate-300 hover:bg-slate-400'
                                    }`}
                                    aria-label={`Ir para imagem ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    );
}
