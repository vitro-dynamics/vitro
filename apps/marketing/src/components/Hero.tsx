export default function Hero() {
	return (
		<section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
			<h1 className="text-5xl font-bold mb-4">vitro</h1>
			<p className="text-xl text-muted-foreground mb-8 max-w-lg">
				The simplest way to get things done.
			</p>
			<a
				href={`${import.meta.env.PUBLIC_APP_URL ?? ""}/signup`}
				className="px-6 py-3 bg-primary text-primary-foreground font-medium border shadow-md"
			>
				Get started
			</a>
		</section>
	);
}
