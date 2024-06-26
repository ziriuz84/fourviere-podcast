import ContainerTitle from "@fourviere/ui/lib/container-title";
import FormRow from "@fourviere/ui/lib/form/form-row";
import FormSection from "@fourviere/ui/lib/form/form-section";
import VStack from "@fourviere/ui/lib/layouts/v-stack";
import {
  Formik,
  FormikValues,
  Field as FormikField,
  FieldProps,
  FormikErrors,
} from "formik";
import Boolean from "@fourviere/ui/lib/form/fields/boolean";
import Text from "@fourviere/ui/lib/form/fields/text";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import localize from "ajv-i18n/localize";
import { useTranslation } from "react-i18next";
import Grid, { GridCell } from "@fourviere/ui/lib/layouts/grid";
import Input from "@fourviere/ui/lib/form/fields/input";
import Select from "@fourviere/ui/lib/form/fields/select";
import { ComponentType, InputHTMLAttributes, useMemo } from "react";
import ArrayForm from "@fourviere/ui/lib/form/fields/array";
import { ErrorBox } from "../box";
import { ajvErrorsToJsonPath, getLabelByName } from "./utils";
import Uuid from "./fields/uuid";
import ChangeDetector from "./change-detector";

const ajv = addFormats(
  new Ajv({
    allErrors: true,
  }),
);

const COMPONENT_MAP = {
  boolean: Boolean,
  input: Input,
  select: Select,
  array: ArrayForm,
  text: Text,
  uuid: Uuid,
} as const;

type BaseFieldConf = {
  id: string;
  name: string;
  label?: string;
  style?: string;
  defaultValue?: unknown;
  component:
    | keyof typeof COMPONENT_MAP
    | ComponentType<
        FieldProps & {
          label: string;
          touched: boolean;
          fieldProps: { feedId: string };
        } & InputHTMLAttributes<HTMLInputElement>
      >;
  fieldProps?: Record<string, unknown>;
  hideLabel?: boolean;
  preSlot?: React.ReactNode;
  postSlot?: React.ReactNode;
  width?: "1" | "1/2";
};

interface InputFieldConf extends BaseFieldConf {
  placeholder?: string;
  type?: "number" | "text" | "password" | "hidden";
}

interface UuidFieldConf extends BaseFieldConf {
  placeholder?: string;
  type?: "number" | "text" | "password";
}

export interface ArrayFieldConf extends BaseFieldConf {
  childrenFields: FieldConf[];
  defaultItem?: Record<string, unknown>;
  arrayErrorsFrom: string[];
}

interface SelectFieldConf extends BaseFieldConf {
  hideIfOptionsIsEmpty?: boolean;
  options:
    | Record<string, unknown>
    | ((fieldName: string, data: FormikValues) => Record<string, unknown>);
}

interface TextFieldConf extends BaseFieldConf {}

export type FieldConf =
  | BaseFieldConf
  | InputFieldConf
  | SelectFieldConf
  | ArrayFieldConf
  | TextFieldConf
  | UuidFieldConf;

export type Section<Data> = {
  title?: string;
  description?: string;
  hideTitle?: boolean;
  fields: FieldConf[];
  preSlot?: React.ReactNode;
  postSlot?: React.ReactNode;
  hideWhen?: (data: Data) => boolean;
};

export interface FormProps<DataType> {
  title: string;
  sections: Array<Section<DataType>>;
  data: DataType;
  schema: Record<string, unknown>;
  onSubmit: (values: DataType) => void;
  labels: {
    save: string;
    unsavedChanges: string;
    hasErrors: string;
    isSaving: string;
  };
  onFieldChange?: Array<{
    fieldName: string;
    callback: (
      fieldValue: unknown,
      setFormValue: (
        field: string,
        value: unknown,
        shouldValidate?: boolean,
      ) => Promise<void | FormikErrors<DataType>>,
      setFieldError?: (field: string, message: string) => void,
      setFieldTouched?: (
        field: string,
        isTouched?: boolean,
        shouldValidate?: boolean,
      ) => Promise<void | FormikErrors<DataType>>,
    ) => void;
  }>;
}

export default function Form<DataType extends FormikValues>({
  data,
  sections,
  title,
  onSubmit,
  schema,
  labels,
  onFieldChange,
}: FormProps<DataType>) {
  const { i18n } = useTranslation();
  const compiledSchema = useMemo(() => {
    return ajv.compile(schema);
  }, [schema]);

  return (
    <Formik
      initialValues={data}
      enableReinitialize
      validate={(values: DataType) => {
        const valid = compiledSchema(values);
        if (!valid) {
          const language = i18n.language as keyof typeof localize;
          localize[language](compiledSchema.errors);
          return ajvErrorsToJsonPath(compiledSchema?.errors);
        }
      }}
      onSubmit={(values, { setSubmitting }) => {
        onSubmit(values);
        setSubmitting(false);
      }}
    >
      {({
        dirty,
        isSubmitting,
        handleSubmit,
        isValid,
        touched,
        errors,
        values,
      }) => {
        JSON.stringify(values);
        return (
          <VStack>
            <ChangeDetector<DataType>
              changeCallbacks={onFieldChange}
              initialData={data}
            />

            <ContainerTitle
              labels={{
                save: labels.save,
                unsavedChanges: labels.unsavedChanges,
                isSaving: labels.isSaving,
              }}
              isDirty={dirty}
              isDisabled={!isValid}
              isSubmitting={isSubmitting}
              onSave={() => handleSubmit()}
            >
              {title}
            </ContainerTitle>
            <div className="sticky top-[75px] z-10 p-3">
              {Object.keys(touched).length > 0 && !isValid && (
                <ErrorBox>
                  <div>
                    <ul>
                      {Object.entries(errors)?.map(([k, e]) => (
                        <li key={k}>
                          <span className="font-semibold">
                            {`${getLabelByName<DataType>(sections, k)}: `}
                          </span>
                          <span className="lowercase">{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ErrorBox>
              )}
            </div>
            {sections.map((section) => {
              if (section?.hideWhen && section.hideWhen(values)) {
                return null;
              }
              return (
                <div key={section.title}>
                  {section.preSlot}
                  <FormSection
                    title={section.title}
                    description={section.description}
                    hideTitle={section.hideTitle}
                  >
                    <Grid cols="1" mdCols="2" spacing="4">
                      {section.fields.map((field, index) => {
                        return generateFormikField({
                          field,
                          index,
                        });
                      })}
                    </Grid>
                  </FormSection>
                  {section.postSlot}
                </div>
              );
            })}
          </VStack>
        );
      }}
    </Formik>
  );
}

export function generateFormikField({
  field,
  index,
  fieldNamePrefix,
}: {
  field: FieldConf;
  index: number;
  // touched: FormikTouched<unknown>;
  // Used for array fields
  fieldNamePrefix?: string;
}) {
  const props: Record<string, unknown> = {};

  if (field.fieldProps) {
    props["fieldProps"] = field.fieldProps;
  }

  props["hideLabel"] = field.hideLabel;

  if (field.component === "select" && (field as SelectFieldConf).options) {
    props["options"] = (field as SelectFieldConf).options;
    props["hideIfOptionsIsEmpty"] = (
      field as SelectFieldConf
    ).hideIfOptionsIsEmpty;
  }

  if (field.component === "input" && (field as InputFieldConf).type) {
    props["type"] = (field as InputFieldConf).type;
  }

  if (
    typeof field.component === "string" &&
    ["input", "uuid"].includes(field.component) &&
    (field as InputFieldConf).placeholder
  ) {
    props["placeholder"] = (field as InputFieldConf).placeholder;
  }

  if (field.component === "array" && (field as ArrayFieldConf).childrenFields) {
    props["childrenFields"] = (field as ArrayFieldConf).childrenFields;
    props["defaultItem"] = (field as ArrayFieldConf).defaultItem;
    props["fieldNamePrefix"] = fieldNamePrefix;
  }

  let name = `${fieldNamePrefix ? fieldNamePrefix + "." : ""}${field.name}`;
  // handle the case when the element of the array is a string
  if (name.slice(-1) === ".") {
    name = name.substring(0, name.length - 1);
  }

  return (
    <GridCell key={index} mdColSpan={field.width === "1/2" ? 1 : 2}>
      {field?.preSlot}
      <FormRow
        key={field.id}
        htmlFor={field.id}
        label={
          field.component === "boolean" || props?.hideLabel === true
            ? ""
            : field.label
        }
      >
        <FormikField
          name={name}
          label={field.label}
          component={
            COMPONENT_MAP?.[field.component as keyof typeof COMPONENT_MAP] ??
            field.component ??
            "input"
          }
          style={field.style}
          {...props}
        />
      </FormRow>
      {field?.postSlot}
    </GridCell>
  );
}
