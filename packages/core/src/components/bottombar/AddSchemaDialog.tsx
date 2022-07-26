import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Formik } from 'formik';
import React, { type FC } from 'react';
import * as yup from 'yup';
import { useActions } from '../../overmind';
import type { Schema } from '../../types/index';

interface AddSchemaDialogProps {
  handleClose: () => void;
  open: boolean;
}

const formValidation = yup.object().shape({
  name: yup.string().min(3).required('must be have at least ${min} chatacters'),
  css: yup.string().required().url('Must be a valid URL'),
  rng: yup.string().required().url('Must be a valid URL'),
});

const AddSchemaDialog: FC<AddSchemaDialogProps> = ({ handleClose, open }) => {
  const { editor } = useActions();

  const submit = (schema: Partial<Schema>) => {
    editor.addShema(schema as Schema);
    handleClose();
  };

  const close = () => handleClose();

  return (
    <Dialog aria-labelledby="form-dialog-title" onClose={close} open={open}>
      <DialogTitle id="form-dialog-title">Add Schema</DialogTitle>
      <Formik
        enableReinitialize={true}
        initialValues={{ name: '', css: '', rng: '' }}
        onSubmit={(values) => {
          //convert css and schema urls into array
          const newSchema = { name: values.name, rng: [values.rng], css: [values.css] };
          submit(newSchema);
        }}
        validationSchema={formValidation}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, touched, values }) => (
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <TextField
                autoFocus
                error={Boolean(touched.name && errors.name)}
                fullWidth
                helperText={touched.name && errors.name}
                label="Schema Name"
                margin="dense"
                name="name"
                onBlur={handleBlur}
                onChange={handleChange}
                value={values.name}
                variant="standard"
              />
              <TextField
                error={Boolean(touched.rng && errors.rng)}
                fullWidth
                helperText={touched.rng && errors.rng}
                label="Schema URL"
                margin="dense"
                name="rng"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                value={values.rng}
                variant="standard"
              />
              <TextField
                error={Boolean(touched.css && errors.css)}
                fullWidth
                helperText={touched.css && errors.css}
                label="Schema CSS URL"
                margin="dense"
                name="css"
                onBlur={handleBlur}
                onChange={handleChange}
                placeholder="https://"
                value={values.css}
                variant="standard"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogActions>
          </form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AddSchemaDialog;
