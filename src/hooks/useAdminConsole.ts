import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminConsoleApi } from "@/lib/adminConsoleApi";

export const useAdminDashboardData = () => {
  const [moviesQuery, pendingQuery, creatorsQuery, subscribersQuery, jobsQuery, logsQuery] =
    useQueries({
      queries: [
        { queryKey: ["admin", "movies"], queryFn: adminConsoleApi.listMovies },
        { queryKey: ["admin", "pendingMovies"], queryFn: adminConsoleApi.listPendingMovies },
        { queryKey: ["admin", "creators"], queryFn: adminConsoleApi.listCreators },
        { queryKey: ["admin", "subscribers"], queryFn: adminConsoleApi.listSubscribers },
        { queryKey: ["admin", "processingJobs"], queryFn: adminConsoleApi.listProcessingJobs },
        { queryKey: ["admin", "auditLogs"], queryFn: () => adminConsoleApi.listAuditLogs() },
      ],
    });

  return {
    queries: { moviesQuery, pendingQuery, creatorsQuery, subscribersQuery, jobsQuery, logsQuery },
    metrics: {
      totalMovies: moviesQuery.data?.length ?? 0,
      pendingApprovals: pendingQuery.data?.length ?? 0,
      activeCreators:
        creatorsQuery.data?.filter(
          (creator) =>
            creator.account_status === "approved" || creator.account_status === "verified"
        ).length ?? 0,
      totalSubscribers: subscribersQuery.data?.length ?? 0,
      failedJobs:
        jobsQuery.data?.filter((job) => job.status === "failed").length ?? 0,
      moderationAlerts:
        logsQuery.data?.filter((log) => log.action === "movie_reviewed").length ?? 0,
      monthlyRevenue:
        creatorsQuery.data?.reduce(
          (total, creator) => total + Number(creator.total_earnings || 0),
          0
        ) ?? 0,
    },
  };
};

export const useAdminMovies = () =>
  useQuery({
    queryKey: ["admin", "movies"],
    queryFn: adminConsoleApi.listMovies,
  });

export const usePendingApprovalMovies = () =>
  useQuery({
    queryKey: ["admin", "pendingMovies"],
    queryFn: adminConsoleApi.listPendingMovies,
  });

export const useCreatorProfiles = () =>
  useQuery({
    queryKey: ["admin", "creators"],
    queryFn: adminConsoleApi.listCreators,
  });

export const useSubscribers = () =>
  useQuery({
    queryKey: ["admin", "subscribers"],
    queryFn: adminConsoleApi.listSubscribers,
  });

export const useMovieAssets = () =>
  useQuery({
    queryKey: ["admin", "movieAssets"],
    queryFn: adminConsoleApi.listMovieAssets,
  });

export const useProcessingJobs = () =>
  useQuery({
    queryKey: ["admin", "processingJobs"],
    queryFn: adminConsoleApi.listProcessingJobs,
  });

export const useMovieReviews = () =>
  useQuery({
    queryKey: ["admin", "movieReviews"],
    queryFn: adminConsoleApi.listMovieReviews,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminConsoleApi.listCategories,
  });

export const useHomepageRows = () =>
  useQueries({
    queries: [
      {
        queryKey: ["admin", "homepageRows"],
        queryFn: adminConsoleApi.listHomepageRows,
      },
      {
        queryKey: ["admin", "homepageRowItems"],
        queryFn: adminConsoleApi.listHomepageRowItems,
      },
    ],
  });

export const useAuditLogs = (search?: string) =>
  useQuery({
    queryKey: ["admin", "auditLogs", search ?? ""],
    queryFn: () => adminConsoleApi.listAuditLogs(search),
  });

export const useAdminMutation = () => {
  const queryClient = useQueryClient();

  const invalidateAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin"] }),
      queryClient.invalidateQueries({ queryKey: ["movies"] }),
      queryClient.invalidateQueries({ queryKey: ["movie"] }),
      queryClient.invalidateQueries({ queryKey: ["homepage"] }),
    ]);
  };

  return {
    createMovie: useMutation({
      mutationFn: adminConsoleApi.createMovie,
      onSuccess: invalidateAdminData,
    }),
    updateMovie: useMutation({
      mutationFn: ({ movieId, payload }: { movieId: string; payload: Record<string, unknown> }) =>
        adminConsoleApi.updateMovie(movieId, payload),
      onSuccess: invalidateAdminData,
    }),
    deleteMovie: useMutation({
      mutationFn: (movieId: string) => adminConsoleApi.deleteMovie(movieId),
      onSuccess: invalidateAdminData,
    }),
    reviewMovie: useMutation({
      mutationFn: ({ movieId, payload }: { movieId: string; payload: Record<string, unknown> }) =>
        adminConsoleApi.reviewMovie(movieId, payload),
      onSuccess: invalidateAdminData,
    }),
    publishMovie: useMutation({
      mutationFn: ({ movieId, payload }: { movieId: string; payload: Record<string, unknown> }) =>
        adminConsoleApi.publishMovie(movieId, payload),
      onSuccess: invalidateAdminData,
    }),
    updateCreator: useMutation({
      mutationFn: ({
        creatorId,
        payload,
      }: {
        creatorId: string;
        payload: Record<string, unknown>;
      }) => adminConsoleApi.updateCreator(creatorId, payload),
      onSuccess: invalidateAdminData,
    }),
    beginUpload: useMutation({
      mutationFn: adminConsoleApi.beginUpload,
      onSuccess: invalidateAdminData,
    }),
    completeUpload: useMutation({
      mutationFn: adminConsoleApi.completeUpload,
      onSuccess: invalidateAdminData,
    }),
    updateHomepage: useMutation({
      mutationFn: adminConsoleApi.updateHomepage,
      onSuccess: invalidateAdminData,
    }),
    saveCategory: useMutation({
      mutationFn: adminConsoleApi.saveCategory,
      onSuccess: invalidateAdminData,
    }),
  };
};
