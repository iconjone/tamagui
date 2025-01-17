import { Container } from '@components/Container'
import { APIGuildMember, RESTGetAPIGuildMembersSearchResult } from '@discordjs/core'
import { getDefaultLayout } from '@lib/getDefaultLayout'
import { Json } from '@lib/supabase-types'
import { getArray, getSingle } from '@lib/supabase-utils'
import { ArrowUpRight, Search } from '@tamagui/lucide-icons'
import { ButtonLink } from 'components/Link'
import { UserGuard, useUser } from 'hooks/useUser'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { useState } from 'react'
import useSWR, { mutate, useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import {
  Avatar,
  Button,
  Fieldset,
  Form,
  H2,
  H3,
  H6,
  Image,
  Input,
  Label,
  Paragraph,
  Separator,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from 'tamagui'

export default function Page() {
  return (
    <>
      <NextSeo
        title="Subscriptions — Tamagui"
        description="A better universal UI system."
      />

      <UserGuard>
        <Subscriptions />
      </UserGuard>
    </>
  )
}

const Subscriptions = () => {
  const { data, isLoading } = useUser()

  if (isLoading || !data) {
    return <Spinner my="$10" />
  }

  const { subscriptions } = data
  if (!subscriptions) return null
  return (
    <Container f={1} py="$8" gap="$8">
      <GithubAppMessage />
      <H2>Subscriptions</H2>
      <YStack gap="$8">
        {subscriptions.length === 0 && (
          <Paragraph ta="center" theme="alt1">
            You don't have any subscriptions.
          </Paragraph>
        )}
        {subscriptions.map((sub) => {
          return <SubscriptionDetail key={sub.id} subscription={sub} />
        })}
      </YStack>
    </Container>
  )
}

type SubscriptionDetailProps = {
  subscription: Exclude<
    Exclude<ReturnType<typeof useUser>['data'], undefined>['subscriptions'],
    null | undefined
  >[number]
}

const dateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  day: 'numeric',
})

const SubscriptionDetail = ({ subscription }: SubscriptionDetailProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const startDate = new Date(subscription.created)
  const periodEnd = new Date(subscription.current_period_end)
  const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at) : null
  const items = getArray(subscription.subscription_items)
  const { mutate } = useSWRConfig()

  if (!items) return null

  async function handleCancelSubscription() {
    mutate(['user'])
    setIsLoading(true)
    try {
      const res = await fetch(`/api/cancel-subscription`, {
        body: JSON.stringify({
          subscription_id: subscription.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const data = await res.json()

      // delay so stripe calls us first
      await new Promise((res) => setTimeout(() => res(true), 1000))

      await mutate('user')

      if (data.message) {
        alert(data.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleActivateSubscription() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/activate-subscription`, {
        body: JSON.stringify({
          subscription_id: subscription.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const data = await res.json()

      // delay so stripe calls us first
      await new Promise((res) => setTimeout(() => res(true), 1000))

      await mutate('user')

      if (data.message) {
        alert(data.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <YStack
      borderColor="$color2"
      borderWidth="$1"
      borderRadius="$4"
      key={subscription.id}
      id={subscription.id}
      separator={<Separator />}
    >
      <YStack
        p="$4"
        theme="alt2"
        gap="$2"
        // separator={<Separator />}
        flexWrap="wrap"
      >
        <XStack gap="$2" separator={<Separator vertical my="$1" />} flexWrap="wrap">
          <SizableText>Started at {dateFormatter.format(startDate)}</SizableText>
          <SizableText>
            Current period ends at {dateFormatter.format(periodEnd)}
          </SizableText>
          {canceledAt ? (
            <SizableText>
              Canceled at {dateFormatter.format(canceledAt)} -{' '}
              <SizableText
                theme="blue_alt2"
                textDecorationLine="underline"
                cursor="pointer"
                userSelect="none"
                {...(isLoading && { opacity: 0.5 })}
                onPress={() => !isLoading && handleActivateSubscription()}
              >
                Re-Activate
              </SizableText>
            </SizableText>
          ) : (
            <SizableText
              cursor="pointer"
              userSelect="none"
              textDecorationLine="underline"
              {...(isLoading && { opacity: 0.5 })}
              onPress={() => !isLoading && handleCancelSubscription()}
            >
              Cancel Subscription
            </SizableText>
          )}
        </XStack>
        <XStack gap="$4" separator={<Separator vertical my="$1" />} flexWrap="wrap">
          <SizableText>Sub ID: {subscription.id}</SizableText>
          <SizableText>
            <SizableText>Status: </SizableText>
            <SizableText
              textTransform="capitalize"
              color={subscription.status === 'active' ? '$green9' : '$yellow9'}
            >
              {subscription.status}
            </SizableText>
          </SizableText>
        </XStack>
      </YStack>
      <YStack p="$4" gap="$4" separator={<Separator />}>
        {items.map((item) => {
          const price = getSingle(item?.prices)
          const product = getSingle(price?.products)
          if (!price || !product) return null
          // const product = item?.prices
          return (
            <SubscriptionItem
              key={`${price.id}-${subscription.id}`}
              item={item}
              subscription={subscription}
            />
          )
        })}
      </YStack>
    </YStack>
  )
}

const SubscriptionItem = ({
  item,
  subscription,
}: {
  item: Exclude<
    SubscriptionDetailProps['subscription']['subscription_items'],
    undefined | null
  >[number]
  subscription: SubscriptionDetailProps['subscription']
}) => {
  const hasDiscordInvites =
    (item.price.product?.metadata as Record<string, any>).slug === 'universal-starter'

  // const { mutate } = useSWRConfig()
  const [isLoading, setIsLoading] = useState(false)
  const product = item.price.product
  const metadata = product?.metadata as { [key: string]: Json }
  const claimLabel = metadata.claim_label ?? 'Claim'

  if (!product) {
    return null
  }
  const installInstructions = (product.metadata as any).install_instructions
  const hasGithubApp = (product.metadata as any).has_github_app

  // async function handleRemoveFormSub() {
  //   setIsLoading(true)
  //   try {
  //     const res = await fetch(`/api/remove-subscription-item`, {
  //       body: JSON.stringify({
  //         subscription_item_id: item.id,
  //       }),
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       method: 'POST',
  //     })

  //     const data = await res.json()

  //     // delay so stripe calls us first
  //     await new Promise((res) => setTimeout(() => res(true), 1000))

  //     await mutate('user')

  //     if (data.message) {
  //       alert(data.message)
  //     }
  //   } finally {
  //     setIsLoading(false)
  //   }
  // }

  async function handleGrantAccess() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/claim`, {
        body: JSON.stringify({
          subscription_id: subscription.id,
          product_id: product!.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const data = await res.json()

      if (data.message) {
        alert(data.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const productSlug =
    typeof product.metadata === 'object' &&
    !Array.isArray(product.metadata) &&
    product.metadata
      ? product.metadata.slug
      : null

  return (
    <YStack key={product.id} gap="$4">
      <XStack gap="$2" jc="space-between">
        <Image
          source={{
            width: 100,
            height: 100,
            uri: product.image ?? '/guy.png',
          }}
          borderRadius="$4"
        />
        <YStack />
        <YStack gap="$2">
          <Button
            size="$2"
            themeInverse
            onPress={() => handleGrantAccess()}
            disabled={isLoading}
            {...(isLoading && { opacity: 0.5 })}
          >
            {claimLabel}
          </Button>
          {hasGithubApp && item.id && (
            <ButtonLink
              href={`/api/github/install-bot?${new URLSearchParams({
                subscription_item_id: item.id.toString(),
              })}`}
              size="$2"
              themeInverse
            >
              Install GitHub App
            </ButtonLink>
          )}
          {/* <Button
            disabled={isLoading}
            {...(isLoading && { opacity: 0.5 })}
            theme="red"
            onPress={() => handleRemoveFormSub()}
            size="$2"
          >
            Remove From Sub
          </Button> */}
        </YStack>
      </XStack>
      <YStack>
        <H3>{product.name}</H3>
        <Paragraph theme="alt1">{product.description}</Paragraph>
      </YStack>
      <YStack gap="$4" separator={<Separator />}>
        <YStack>
          {installInstructions && (
            <YStack>
              <H6>How to use</H6>
              <Paragraph mt="$2">{installInstructions}</Paragraph>
            </YStack>
          )}
        </YStack>
        {hasDiscordInvites && <DiscordPanel subscriptionId={subscription.id} />}
      </YStack>
    </YStack>
  )
}

const DiscordPanel = ({ subscriptionId }: { subscriptionId: string }) => {
  const groupInfoSwr = useSWR<{ current: number; max: number }>(
    `/api/discord/channel?${new URLSearchParams({ subscription_id: subscriptionId })}`,
    (url) =>
      fetch(url, { headers: { 'Content-Type': 'application/json' } }).then((res) =>
        res.json()
      )
  )
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState(draftQuery)
  const searchSwr = useSWR<RESTGetAPIGuildMembersSearchResult>(
    query
      ? `/api/discord/search-member?${new URLSearchParams({ query }).toString()}`
      : null,
    (url) =>
      fetch(url, { headers: { 'Content-Type': 'application/json' } }).then((res) =>
        res.json()
      )
  )

  const resetChannelMutation = useSWRMutation(
    [`/api/discord/channel`, 'DELETE', subscriptionId],
    (url) =>
      fetch(`/api/discord/channel`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
        }),
      }).then((res) => res.json()),
    {
      onSuccess: async () => {
        await mutate(
          `/api/discord/channel?${new URLSearchParams({
            subscription_id: subscriptionId,
          })}`
        )
        setDraftQuery('')
        setQuery('')
      },
    }
  )

  const handleSearch = async () => {
    setQuery(draftQuery)
  }

  return (
    <YStack gap="$2">
      <XStack jc="space-between" gap="$2" ai="center">
        <H6>
          Discord Access{' '}
          {!!groupInfoSwr.data &&
            `(${groupInfoSwr.data?.current}/${groupInfoSwr.data?.max})`}
        </H6>
        <Button
          size="$2"
          onPress={() => resetChannelMutation.trigger()}
          disabled={resetChannelMutation.isMutating}
        >
          {resetChannelMutation.isMutating ? 'Resetting...' : 'Reset'}
        </Button>
      </XStack>
      <Form onSubmit={handleSearch} gap="$2" flexDirection="row" ai="flex-end">
        <Fieldset>
          <Label size="$2" htmlFor="discord-username">
            Username / Nickname
          </Label>
          <Input
            size="$2"
            placeholder="Your username..."
            id="discord-username"
            value={draftQuery}
            onChangeText={setDraftQuery}
          />
        </Fieldset>

        <Form.Trigger>
          <Button size="$2" icon={Search}>
            Search
          </Button>
        </Form.Trigger>
      </Form>

      <YStack gap="$2">
        {searchSwr.data?.map((member) => {
          return (
            <DiscordMember
              key={member.user?.id}
              member={member}
              subscriptionId={subscriptionId}
            />
          )
        })}
      </YStack>
    </YStack>
  )
}

const DiscordMember = ({
  member,
  subscriptionId,
}: {
  member: APIGuildMember
  subscriptionId: string
}) => {
  const { data, error, isMutating, trigger } = useSWRMutation(
    ['/api/discord/channel', 'POST', member.user?.id],
    async () => {
      const res = await fetch('/api/discord/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          discord_id: member.user?.id,
        }),
      })

      if (res.status < 200 || res.status > 299) {
        throw await res.json()
      }
      return await res.json()
    },
    {
      onSuccess: async () => {
        await mutate(
          `/api/discord/channel?${new URLSearchParams({
            subscription_id: subscriptionId,
          })}`
        )
      },
    }
  )

  const name = member.nick || member.user?.global_name

  const username = `${member.user?.username}${
    member.user?.discriminator !== '0' ? `#${member.user?.discriminator}` : ''
  }`
  const avatarSrc = member.user?.avatar
    ? `https://cdn.discordapp.com/avatars/${member.user?.id}/${member.user?.avatar}.png`
    : null
  return (
    <XStack gap="$2" ai="center" flexWrap="wrap">
      <Button minWidth={70} size="$2" disabled={isMutating} onPress={() => trigger()}>
        {isMutating ? 'Inviting...' : 'Add'}
      </Button>
      <Avatar circular size="$2">
        <Avatar.Image accessibilityLabel={`avatar for ${username}`} src={avatarSrc!} />
        <Avatar.Fallback backgroundColor="$blue10" />
      </Avatar>
      <Paragraph>{`${username}${name ? ` (${name})` : ''}`}</Paragraph>
      {data && (
        <Paragraph size="$1" theme="green_alt2">
          {data.message}
        </Paragraph>
      )}
      {error && (
        <Paragraph size="$1" theme="red_alt2">
          {error.message}
        </Paragraph>
      )}
    </XStack>
  )
}

const GithubAppMessage = () => {
  const router = useRouter()
  const githubAppInstalled = !!router.query.github_app_installed
  if (!githubAppInstalled) return null
  return (
    <Paragraph theme="green_alt2">
      GitHub App installed successfully. We will create PRs to your fork as we ship new
      updates.
    </Paragraph>
  )
}

Page.getLayout = getDefaultLayout
