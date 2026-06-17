import { motion } from 'framer-motion';

const BootSplash = () => {
    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b]"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
            {/* Aurora blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[340px] h-[340px] rounded-full"
                    style={{
                        left: '10%',
                        top: '20%',
                        background: 'radial-gradient(circle, rgba(196,242,13,.7), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-1 7s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[300px] h-[300px] rounded-full"
                    style={{
                        right: '5%',
                        top: '10%',
                        background: 'radial-gradient(circle, rgba(120,119,255,.6), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-2 9s ease-in-out infinite',
                    }}
                />
                <div
                    className="absolute w-[260px] h-[260px] rounded-full"
                    style={{
                        left: '40%',
                        bottom: 0,
                        background: 'radial-gradient(circle, rgba(34,211,238,.5), transparent 65%)',
                        filter: 'blur(36px)',
                        opacity: 0.55,
                        animation: 'aurora-drift-3 8s ease-in-out infinite',
                    }}
                />
            </div>

            {/* Wordmark + progress bar */}
            <div className="relative z-10 text-center">
                <h1 className="font-display text-[22px] font-bold tracking-tight">
                    modular<span className="text-[var(--theme-color)]">.</span>ai
                </h1>
                <div className="mt-3.5 mx-auto w-[120px] h-[3px] rounded-full bg-white/10 overflow-hidden">
                    <div
                        className="h-full w-[40%] rounded-full bg-[var(--theme-color)]"
                        style={{ animation: 'shimmer-slide 1.4s ease-in-out infinite' }}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default BootSplash;
