
import { useQuery } from '@tanstack/react-query';
import { Query } from 'appwrite';
import { databases, appwriteConfig, getMissingAppwriteConfig } from '@/integrations/appwrite/client';
import { AppwriteMovieDocument } from '@/integrations/appwrite/types';
import { Movie } from '@/types/movie';
import { resolveStoredAssetUrl } from '@/lib/media';

const demoMovies: Movie[] = [
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    poster: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=1920&h=1080",
    description: "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
    rating: 7.8,
    year: 2008,
    genre: "Animation, Comedy",
    duration: "10m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=YE7VzlLtp-4",
  },
  {
    id: "sintel",
    title: "Sintel",
    poster: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1920&h=1080",
    description: "A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales. But when he is kidnapped, a determined Sintel decides to find her lost friend.",
    rating: 8.1,
    year: 2010,
    genre: "Animation, Adventure",
    duration: "15m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=eRsGyueVLvQ",
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1920&h=1080",
    description: "In an apocalyptic future, a group of soldiers and scientists takes refuge in Amsterdam to try to stop an army of robots that threatens the planet.",
    rating: 7.5,
    year: 2012,
    genre: "Sci-Fi, Action",
    duration: "12m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=R6MlUcmOul8",
  },
  {
    id: "elephants-dream",
    title: "Elephant's Dream",
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1920&h=1080",
    description: "Two strange characters wander through a surreal landscape made of discarded computer graphics.",
    rating: 7.2,
    year: 2006,
    genre: "Animation, Fantasy",
    duration: "11m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=TLkA0RELQ1g",
  },
  {
    id: "caminandes-llamigos",
    title: "Caminandes: Llamigos",
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1920&h=1080",
    description: "A young llama named Koro discovers that the grass is always greener on the other side.",
    rating: 8.0,
    year: 2016,
    genre: "Animation, Comedy",
    duration: "3m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=SkVqJ1SGeL0",
  },
  {
    id: "spring",
    title: "Spring",
    poster: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=1920&h=1080",
    description: "A young shepherd girl is turned into a tree by her stepmother and only the Spring Goddess can help her.",
    rating: 8.3,
    year: 2019,
    genre: "Animation, Fantasy",
    duration: "8m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=WhWc3b3KhnY",
  },
  {
    id: "hero",
    title: "Hero",
    poster: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&h=1080",
    description: "A baby elephant is stuck in a muddy waterhole and it's up to his family and friends to help rescue him.",
    rating: 7.9,
    year: 2018,
    genre: "Animation, Family",
    duration: "6m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=yKWQgKAjFks",
  },
  {
    id: "agent-327-operation-barbershop",
    title: "Agent 327: Operation Barbershop",
    poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=400&h=600",
    backdrop: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1920&h=1080",
    description: "Super spy Agent 327 is on a mission to stop the evil Barbershop from taking over the world.",
    rating: 8.2,
    year: 2017,
    genre: "Animation, Action",
    duration: "4m",
    status: "published",
    video_url: "https://www.youtube.com/watch?v=mN0zPOpADL4",
  },
];

const mapMovieDocument = (movie: AppwriteMovieDocument): Movie => ({
  id: movie.$id,
  title: movie.title,
  poster: resolveStoredAssetUrl(movie.poster),
  backdrop: resolveStoredAssetUrl(movie.backdrop),
  description: movie.description,
  rating: movie.rating,
  year: movie.year,
  genre: movie.genre,
  duration: movie.duration,
  banner: movie.banner ? resolveStoredAssetUrl(movie.banner) : undefined,
  trailer: movie.trailer ? resolveStoredAssetUrl(movie.trailer) : undefined,
  cast: movie.cast || undefined,
  director: movie.director || undefined,
  language: movie.language || undefined,
  country: movie.country || undefined,
  age_rating: movie.age_rating || undefined,
  status: movie.status,
  creator_user_id: movie.creator_user_id || undefined,
  revenue_share_percent:
    typeof movie.revenue_share_percent === "number"
      ? movie.revenue_share_percent
      : undefined,
  release_date: movie.release_date || undefined,
  subscription_availability: movie.subscription_availability || undefined,
  featured_on_homepage: Boolean(movie.featured_on_homepage),
  category_ids: movie.category_ids || [],
  rejection_reason_code: movie.rejection_reason_code || undefined,
  rejection_reason_note: movie.rejection_reason_note || undefined,
  video_url: movie.video_url ? resolveStoredAssetUrl(movie.video_url) : undefined,
});

const getMoviesCollectionError = () =>
  new Error(
    `Missing Appwrite database configuration: ${getMissingAppwriteConfig('database').join(', ')}`
  );

export const useMovies = () => {
  return useQuery({
    queryKey: ['movies'],
    queryFn: async (): Promise<Movie[]> => {
      if (!databases) {
        console.warn(getMoviesCollectionError().message);
        return demoMovies;
      }

      try {
        const response = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.movies,
          [Query.equal("status", ["published"]), Query.orderDesc("$updatedAt")]
        );

        return response.documents.map((movie) =>
          mapMovieDocument(movie as AppwriteMovieDocument)
        );
      } catch (error) {
        console.warn('Falling back to demo movies because Appwrite movie fetch failed.', error);
        return demoMovies;
      }
    },
  });
};

export const useMovie = (id?: string) => {
  return useQuery({
    queryKey: ['movie', id],
    queryFn: async (): Promise<Movie | null> => {
      if (!id) {
        return null;
      }

      if (!databases) {
        return demoMovies.find((movie) => movie.id === id) || null;
      }

      try {
        const movie = await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.movies,
          id
        );

        const mappedMovie = mapMovieDocument(movie as AppwriteMovieDocument);

        return mappedMovie.status === "published" ? mappedMovie : null;
      } catch (error) {
        console.warn(`Falling back to demo movie for id "${id}" because Appwrite fetch failed.`, error);
        return demoMovies.find((movie) => movie.id === id) || null;
      }
    },
    enabled: !!id,
  });
};
