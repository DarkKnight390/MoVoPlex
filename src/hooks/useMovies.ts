
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/types/movie';

export const useMovies = () => {
  return useQuery({
    queryKey: ['movies'],
    queryFn: async (): Promise<Movie[]> => {
      // For now, return some free movies with YouTube links
      const freeMovies: Movie[] = [
        {
          id: 1,
          title: "Big Buck Bunny",
          poster: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=1920&h=1080",
          description: "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
          rating: 7.8,
          year: 2008,
          genre: "Animation, Comedy",
          duration: "10m",
          video_url: "https://www.youtube.com/watch?v=YE7VzlLtp-4"
        },
        {
          id: 2,
          title: "Sintel",
          poster: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1920&h=1080",
          description: "A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales. But when he is kidnapped, a determined Sintel decides to find her lost friend.",
          rating: 8.1,
          year: 2010,
          genre: "Animation, Adventure",
          duration: "15m",
          video_url: "https://www.youtube.com/watch?v=eRsGyueVLvQ"
        },
        {
          id: 3,
          title: "Tears of Steel",
          poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1920&h=1080",
          description: "In an apocalyptic future, a group of soldiers and scientists takes refuge in Amsterdam to try to stop an army of robots that threatens the planet.",
          rating: 7.5,
          year: 2012,
          genre: "Sci-Fi, Action",
          duration: "12m",
          video_url: "https://www.youtube.com/watch?v=R6MlUcmOul8"
        },
        {
          id: 4,
          title: "Elephant's Dream",
          poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1920&h=1080",
          description: "Two strange characters wander through a surreal landscape made of discarded computer graphics.",
          rating: 7.2,
          year: 2006,
          genre: "Animation, Fantasy",
          duration: "11m",
          video_url: "https://www.youtube.com/watch?v=TLkA0RELQ1g"
        },
        {
          id: 5,
          title: "Caminandes: Llamigos",
          poster: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1920&h=1080",
          description: "A young llama named Koro discovers that the grass is always greener on the other side.",
          rating: 8.0,
          year: 2016,
          genre: "Animation, Comedy",
          duration: "3m",
          video_url: "https://www.youtube.com/watch?v=SkVqJ1SGeL0"
        },
        {
          id: 6,
          title: "Spring",
          poster: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=1920&h=1080",
          description: "A young shepherd girl is turned into a tree by her stepmother and only the Spring Goddess can help her.",
          rating: 8.3,
          year: 2019,
          genre: "Animation, Fantasy",
          duration: "8m",
          video_url: "https://www.youtube.com/watch?v=WhWc3b3KhnY"
        },
        {
          id: 7,
          title: "Hero",
          poster: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&h=1080",
          description: "A baby elephant is stuck in a muddy waterhole and it's up to his family and friends to help rescue him.",
          rating: 7.9,
          year: 2018,
          genre: "Animation, Family",
          duration: "6m",
          video_url: "https://www.youtube.com/watch?v=yKWQgKAjFks"
        },
        {
          id: 8,
          title: "Agent 327: Operation Barbershop",
          poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1920&h=1080",
          description: "Super spy Agent 327 is on a mission to stop the evil Barbershop from taking over the world.",
          rating: 8.2,
          year: 2017,
          genre: "Animation, Action",
          duration: "4m",
          video_url: "https://www.youtube.com/watch?v=mN0zPOpADL4"
        }
      ];

      return freeMovies;
    },
  });
};

export const useMovie = (id: number) => {
  return useQuery({
    queryKey: ['movie', id],
    queryFn: async (): Promise<Movie | null> => {
      // For now, return from the same free movies list
      const freeMovies: Movie[] = [
        {
          id: 1,
          title: "Big Buck Bunny",
          poster: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1489599480396-4e3c61a81b79?auto=format&fit=crop&w=1920&h=1080",
          description: "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
          rating: 7.8,
          year: 2008,
          genre: "Animation, Comedy",
          duration: "10m",
          video_url: "https://www.youtube.com/watch?v=YE7VzlLtp-4"
        },
        {
          id: 2,
          title: "Sintel",
          poster: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1920&h=1080",
          description: "A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales. But when he is kidnapped, a determined Sintel decides to find her lost friend.",
          rating: 8.1,
          year: 2010,
          genre: "Animation, Adventure",
          duration: "15m",
          video_url: "https://www.youtube.com/watch?v=eRsGyueVLvQ"
        },
        {
          id: 3,
          title: "Tears of Steel",
          poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1920&h=1080",
          description: "In an apocalyptic future, a group of soldiers and scientists takes refuge in Amsterdam to try to stop an army of robots that threatens the planet.",
          rating: 7.5,
          year: 2012,
          genre: "Sci-Fi, Action",
          duration: "12m",
          video_url: "https://www.youtube.com/watch?v=R6MlUcmOul8"
        },
        {
          id: 4,
          title: "Elephant's Dream",
          poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=1920&h=1080",
          description: "Two strange characters wander through a surreal landscape made of discarded computer graphics.",
          rating: 7.2,
          year: 2006,
          genre: "Animation, Fantasy",
          duration: "11m",
          video_url: "https://www.youtube.com/watch?v=TLkA0RELQ1g"
        },
        {
          id: 5,
          title: "Caminandes: Llamigos",
          poster: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1920&h=1080",
          description: "A young llama named Koro discovers that the grass is always greener on the other side.",
          rating: 8.0,
          year: 2016,
          genre: "Animation, Comedy",
          duration: "3m",
          video_url: "https://www.youtube.com/watch?v=SkVqJ1SGeL0"
        },
        {
          id: 6,
          title: "Spring",
          poster: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=1920&h=1080",
          description: "A young shepherd girl is turned into a tree by her stepmother and only the Spring Goddess can help her.",
          rating: 8.3,
          year: 2019,
          genre: "Animation, Fantasy",
          duration: "8m",
          video_url: "https://www.youtube.com/watch?v=WhWc3b3KhnY"
        },
        {
          id: 7,
          title: "Hero",
          poster: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&h=1080",
          description: "A baby elephant is stuck in a muddy waterhole and it's up to his family and friends to help rescue him.",
          rating: 7.9,
          year: 2018,
          genre: "Animation, Family",
          duration: "6m",
          video_url: "https://www.youtube.com/watch?v=yKWQgKAjFks"
        },
        {
          id: 8,
          title: "Agent 327: Operation Barbershop",
          poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=400&h=600",
          backdrop: "https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1920&h=1080",
          description: "Super spy Agent 327 is on a mission to stop the evil Barbershop from taking over the world.",
          rating: 8.2,
          year: 2017,
          genre: "Animation, Action",
          duration: "4m",
          video_url: "https://www.youtube.com/watch?v=mN0zPOpADL4"
        }
      ];

      const movie = freeMovies.find(m => m.id === id);
      return movie || null;
    },
    enabled: !!id,
  });
};
