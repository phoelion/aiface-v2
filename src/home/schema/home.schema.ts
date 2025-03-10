import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, } from 'mongoose';

export type HomeDocument = HydratedDocument<Home>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Home extends Document {
  @Prop({ type: Object })
  icons: { [key: string]: string };
  @Prop({ type: Object })
  texts: { [key: string]: string };

  @Prop({ type: Object })
  appConstants: {
    [key: string]: any;
  };
  @Prop({ type: Object })
  features: { [key: string]: boolean };

  id: string;
  _id: string;
}

export const HomeSchema = SchemaFactory.createForClass(Home);

