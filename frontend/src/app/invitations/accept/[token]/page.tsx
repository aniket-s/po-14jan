'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Mail, Building2, Shield, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface Invitation {
  id: number;
  invitation_type: string;
  email: string;
  status: string;
  expires_at: string;
  inviter: {
    name: string;
    company: string | null;
  };
  role: {
    display_name: string;
    description: string | null;
  };
  created_at: string;
}

const acceptanceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
  company: z.string().optional(),
  accept_terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ["password_confirmation"],
});

type AcceptanceFormData = z.infer<typeof acceptanceSchema>;

export default function InvitationAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AcceptanceFormData>({
    resolver: zodResolver(acceptanceSchema),
    defaultValues: {
      accept_terms: false,
    },
  });

  const acceptTerms = watch('accept_terms');

  useEffect(() => {
    if (!token) return;

    const fetchInvitation = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<{ data: Invitation }>(`/invitations/validate/${token}`);
        setInvitation(response.data.data);
      } catch (err: any) {
        console.error('Failed to fetch invitation:', err);
        if (err.response?.status === 404) {
          setError('Invitation not found. The link may be invalid or has been used already.');
        } else if (err.response?.status === 410) {
          setError('This invitation has expired. Please contact the sender for a new invitation.');
        } else if (err.response?.data?.message) {
          setError(err.response.data.message);
        } else {
          setError('Failed to load invitation details. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const onSubmit = async (data: AcceptanceFormData) => {
    if (!token) return;

    try {
      setSubmitting(true);
      setError(null);

      await api.post(`/invitations/${token}/accept`, {
        name: data.name,
        password: data.password,
        password_confirmation: data.password_confirmation,
        company: data.company || null,
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?message=Account created successfully. Please log in.');
      }, 3000);
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.errors) {
        const errorMessages = Object.values(err.response.data.errors).flat();
        setError(errorMessages.join(' '));
      } else {
        setError('Failed to accept invitation. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Get invitation type display name
  const getInvitationTypeDisplay = (type: string): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Check if invitation is expired
  const isExpired = invitation && new Date(invitation.expires_at) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              Invalid Invitation
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you believe this is an error, please contact the person who sent you the invitation.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Welcome Aboard!
            </CardTitle>
            <CardDescription>Your account has been created successfully</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Your account has been activated. You will be redirected to the login page shortly.
              </p>
            </div>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-6 w-6" />
              Invitation Expired
            </CardTitle>
            <CardDescription>
              This invitation expired on {new Date(invitation.expires_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact {invitation.inviter.name} to request a new invitation.
            </p>
            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Already Accepted
            </CardTitle>
            <CardDescription>
              This invitation has already been accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you have an account, you can log in to access the platform.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <UserPlus className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">You're Invited!</h1>
          </div>
          <p className="text-muted-foreground">
            Complete your registration to join the platform
          </p>
        </div>

        {/* Invitation Details Card */}
        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Invitation Details</CardTitle>
            <CardDescription>
              You've been invited to join as {invitation.role.display_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{invitation.email}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Role</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-base">
                      {invitation.role.display_name}
                    </Badge>
                  </div>
                  {invitation.role.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {invitation.role.description}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Invited By</p>
                  <p className="font-medium">{invitation.inviter.name}</p>
                  {invitation.inviter.company && (
                    <p className="text-sm text-muted-foreground">{invitation.inviter.company}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Invitation Type</p>
                  <p className="font-medium">{getInvitationTypeDisplay(invitation.invitation_type)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Registration</CardTitle>
            <CardDescription>
              Create your account to accept this invitation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="John Doe"
                  autoComplete="name"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  This email is pre-filled from your invitation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company Name (Optional)</Label>
                <Input
                  id="company"
                  {...register('company')}
                  placeholder="Company Name"
                  autoComplete="organization"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password_confirmation">Confirm Password *</Label>
                  <Input
                    id="password_confirmation"
                    type="password"
                    {...register('password_confirmation')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {errors.password_confirmation && (
                    <p className="text-sm text-red-500">{errors.password_confirmation.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="accept_terms"
                    {...register('accept_terms')}
                    className="mt-1 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <Label htmlFor="accept_terms" className="cursor-pointer">
                      I accept the{' '}
                      <a href="/terms" target="_blank" className="text-primary underline">
                        Terms and Conditions
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" target="_blank" className="text-primary underline">
                        Privacy Policy
                      </a>
                    </Label>
                  </div>
                </div>
                {errors.accept_terms && (
                  <p className="text-sm text-red-500">{errors.accept_terms.message}</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !acceptTerms}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept Invitation & Create Account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-primary underline">
              Log in instead
            </a>
          </p>
          <p className="mt-2">
            This invitation expires on{' '}
            <span className="font-medium">
              {new Date(invitation.expires_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
