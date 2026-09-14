// Template for a feature module. Replace "Thing"/"things" and split into the files listed in references/module-layout.md.
import { Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common'

// ---------- domain ----------
export interface Thing {
  id: string
  name: string
}

export class ThingNotFoundError extends Error {
  readonly code = 'THING_NOT_FOUND'
  constructor(readonly id: string) {
    super(`Thing ${id} not found`)
  }
}

// ---------- repository contract ----------
export const THING_REPOSITORY = Symbol('THING_REPOSITORY')

export interface ThingRepository {
  findById(id: string): Promise<Thing | null>
  save(thing: Thing): Promise<void>
}

// ---------- dto ----------
export class CreateThingDto {
  name!: string
}

export class ThingResponseDto {
  constructor(readonly id: string, readonly name: string) {}
  static from(thing: Thing): ThingResponseDto {
    return new ThingResponseDto(thing.id, thing.name)
  }
}

// ---------- service ----------
@Injectable()
export class ThingsService {
  constructor(@Inject(THING_REPOSITORY) private readonly repository: ThingRepository) {}

  async create(input: CreateThingDto): Promise<Thing> {
    const thing: Thing = { id: crypto.randomUUID(), name: input.name }
    await this.repository.save(thing)
    return thing
  }

  async findById(id: string): Promise<Thing> {
    const thing = await this.repository.findById(id)
    if (!thing) throw new ThingNotFoundError(id)
    return thing
  }
}

// ---------- controller ----------
@Controller('things')
export class ThingsController {
  constructor(private readonly things: ThingsService) {}

  @Post()
  async create(@Body() body: CreateThingDto): Promise<ThingResponseDto> {
    return ThingResponseDto.from(await this.things.create(body))
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<ThingResponseDto> {
    try {
      return ThingResponseDto.from(await this.things.findById(id))
    } catch (error) {
      // In real modules the global DomainExceptionFilter does this mapping; shown inline for completeness.
      if (error instanceof ThingNotFoundError) throw new NotFoundException({ code: error.code, message: error.message })
      throw error
    }
  }
}

// ---------- module ----------
@Module({
  controllers: [ThingsController],
  providers: [ThingsService, { provide: THING_REPOSITORY, useClass: class InMemoryThingRepository implements ThingRepository {
    private readonly items = new Map<string, Thing>()
    async findById(id: string) { return this.items.get(id) ?? null }
    async save(thing: Thing) { this.items.set(thing.id, thing) }
  } }],
  exports: [ThingsService],
})
export class ThingsModule {}
